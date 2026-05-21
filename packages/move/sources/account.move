/// MemWal — Account & SEAL Access Control
///
/// Core on-chain module for managing MemWal accounts and delegate keys.
/// Delegate keys are Ed25519 Sui keypairs that can sign transactions
/// and are authorized for SEAL decryption.
///
/// ## Architecture
/// - AccountRegistry: shared object — tracks accounts (prevents duplicates)
/// - MemWalAccount: shared object — stores owner + delegate_keys
/// - DelegateKey: struct with public_key, sui_address, label, created_at
/// - seal_approve: SEAL policy — authorizes owner OR delegate key holder to decrypt
///
/// ## Versioning (HIGH-14 / SEC-303)
/// Both `AccountRegistry` and `MemWalAccount` carry a version stored as a dynamic
/// field on their `UID`. Every mutating entry function asserts the version equals
/// the current `VERSION` constant. Migration paths are provided so that:
///   - owners can self-migrate their `MemWalAccount` (`migrate_account`)
///   - the holder of the package `UpgradeCap` can batch-migrate accounts
///     (`admin_migrate_account`) and migrate the registry (`migrate_registry`)
/// Adding a `version: u64` field to the structs after publish is impossible in Sui
/// Move, so dynamic fields are used. Objects created before this upgrade default
/// to `version = 1` (the implicit pre-upgrade version) until migrated.
module memwal::account {
    use std::string::String;
    use sui::event;
    use sui::table::{Self, Table};
    use sui::clock::Clock;
    use sui::dynamic_field as df;
    use sui::package::{Self, UpgradeCap};

    // ============================================================
    // Error Codes
    // ============================================================

    /// Delegate key already exists in the account
    const EDelegateKeyAlreadyExists: u64 = 0;
    /// Delegate key not found in the account
    const EDelegateKeyNotFound: u64 = 1;
    /// Maximum number of delegate keys reached
    const ETooManyDelegateKeys: u64 = 2;
    /// Account already exists for this address
    const EAccountAlreadyExists: u64 = 3;
    /// Caller is not the account owner
    const ENotOwner: u64 = 4;
    /// Invalid Ed25519 public key length (must be 32 bytes)
    const EInvalidPublicKeyLength: u64 = 5;
    /// Account is deactivated (frozen)
    const EAccountDeactivated: u64 = 6;
    /// Object/registry version does not match the current package VERSION
    const EWrongVersion: u64 = 7;
    /// UpgradeCap does not belong to this package
    const ENotUpgradeAuthority: u64 = 8;
    /// Object/registry already at the target version
    const EAlreadyMigrated: u64 = 9;
    /// Delegate key label exceeds maximum allowed length
    const ELabelTooLong: u64 = 10;
    /// Account is already in the requested active state
    const EAccountAlreadyActive: u64 = 11;
    /// Caller is not authorized to decrypt (SEAL)
    const ENoAccess: u64 = 100;
    /// Heir address cannot equal the owner address (MNEMO inheritance)
    const EHeirIsOwner: u64 = 12;
    /// Requested dormancy period exceeds the maximum allowed (MNEMO inheritance)
    const EDormancyTooLong: u64 = 13;

    /// Maximum delegate keys per account
    const MAX_DELEGATE_KEYS: u64 = 20;
    /// Expected length of an Ed25519 public key in bytes
    const ED25519_PUBLIC_KEY_LENGTH: u64 = 32;
    /// Maximum allowed length of a delegate key label, in bytes (LOW-21)
    const MAX_LABEL_LENGTH: u64 = 64;
    /// MNEMO: maximum dormancy period — 3650 days (~10 years) in milliseconds.
    /// Bounds the heir-access timer and keeps `last_active_ms + dormancy_ms`
    /// far below u64 overflow.
    const MAX_DORMANCY_MS: u64 = 315_360_000_000;

    /// Current package version. Bump when shipping an upgrade that changes
    /// invariants of `AccountRegistry` or `MemWalAccount`.
    const VERSION: u64 = 2;

    /// Dynamic field key used to store the per-object version.
    const VERSION_DF_KEY: vector<u8> = b"version";

    // ============================================================
    // Structs
    // ============================================================

    /// Shared registry — tracks all MemWalAccounts.
    /// Prevents duplicate account creation.
    public struct AccountRegistry has key {
        id: UID,
        /// Maps owner address → account object ID (prevents duplicates)
        accounts: Table<address, ID>,
    }

    /// Main account object — one per user
    /// Stores the list of authorized delegate keys
    public struct MemWalAccount has key, store {
        id: UID,
        /// Owner's Sui address
        owner: address,
        /// List of authorized Ed25519 delegate keys (each with a Sui address)
        delegate_keys: vector<DelegateKey>,
        /// Timestamp when account was created (epoch ms)
        created_at: u64,
        /// Whether the account is active (false = frozen, SEAL access denied)
        active: bool,
        /// MNEMO: designated heir who may decrypt after the dormancy period
        /// lapses. `none` until the owner sets one.
        heir: Option<address>,
        /// MNEMO: dormancy period in milliseconds. After the owner is inactive
        /// for this long, the heir may decrypt. `0` disables inheritance
        /// entirely (the safe default — see `set_dormancy`).
        dormancy_ms: u64,
        /// MNEMO: timestamp (epoch ms) of the owner's last recorded activity.
        /// Refreshed by `touch_activity` and the inheritance setters. The heir
        /// access window is measured from this value.
        last_active_ms: u64,
    }

    /// An authorized Ed25519 delegate key with its derived Sui address
    public struct DelegateKey has store, copy, drop {
        /// Ed25519 public key (32 bytes)
        public_key: vector<u8>,
        /// Sui address derived from this Ed25519 public key
        sui_address: address,
        /// Human-readable label (e.g., "MacBook Pro", "Work Server")
        label: String,
        /// Timestamp when key was added (epoch ms)
        created_at: u64,
    }

    // ============================================================
    // Events
    // ============================================================

    public struct AccountCreated has copy, drop {
        account_id: ID,
        owner: address,
    }

    public struct DelegateKeyAdded has copy, drop {
        account_id: ID,
        public_key: vector<u8>,
        sui_address: address,
        label: String,
    }

    public struct DelegateKeyRemoved has copy, drop {
        account_id: ID,
        public_key: vector<u8>,
        sui_address: address,
    }

    public struct AccountDeactivated has copy, drop {
        account_id: ID,
        owner: address,
    }

    public struct AccountReactivated has copy, drop {
        account_id: ID,
        owner: address,
    }

    public struct HeirSet has copy, drop {
        account_id: ID,
        owner: address,
        heir: address,
    }

    public struct HeirCleared has copy, drop {
        account_id: ID,
        owner: address,
    }

    public struct DormancySet has copy, drop {
        account_id: ID,
        owner: address,
        dormancy_ms: u64,
    }

    public struct HeirClaimAborted has copy, drop {
        account_id: ID,
        owner: address,
    }

    public struct AccountMigrated has copy, drop {
        account_id: ID,
        from: u64,
        to: u64,
    }

    public struct RegistryMigrated has copy, drop {
        registry_id: ID,
        from: u64,
        to: u64,
    }

    // ============================================================
    // Init — runs once at module publish
    // ============================================================

    /// Create AccountRegistry (shared).
    fun init(ctx: &mut TxContext) {
        let mut registry = AccountRegistry {
            id: object::new(ctx),
            accounts: table::new(ctx),
        };
        // Tag the registry with the current VERSION so future upgrades can
        // detect un-migrated objects.
        set_version(&mut registry.id, VERSION);
        transfer::share_object(registry);
    }

    // ============================================================
    // Account Entry Functions
    // ============================================================

    /// Create a new MemWalAccount.
    /// Each address can only create ONE account (enforced by registry).
    entry fun create_account(
        registry: &mut AccountRegistry,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        // Version gating (HIGH-14): the registry must be on the current VERSION
        // before any state mutation is allowed.
        assert_object_version(&registry.id);

        let sender = ctx.sender();

        // Check: no duplicate accounts
        assert!(!registry.accounts.contains(sender), EAccountAlreadyExists);

        let mut account = MemWalAccount {
            id: object::new(ctx),
            owner: sender,
            delegate_keys: vector::empty(),
            created_at: clock.timestamp_ms(),
            active: true,
            // MNEMO: inheritance disabled by default (S5 — default safe).
            heir: option::none(),
            dormancy_ms: 0,
            last_active_ms: clock.timestamp_ms(),
        };
        // New accounts are always created at the current VERSION.
        set_version(&mut account.id, VERSION);

        let account_id = object::id(&account);

        // Register in the registry
        registry.accounts.add(sender, account_id);

        event::emit(AccountCreated {
            account_id,
            owner: sender,
        });

        transfer::share_object(account);
    }

    /// Add a delegate key to the account
    /// Only the owner can add delegate keys
    ///
    /// * `public_key` - Ed25519 public key bytes (32 bytes)
    /// * `sui_address` - Sui address derived from the Ed25519 public key
    /// * `label` - Human-readable label for this key
    entry fun add_delegate_key(
        account: &mut MemWalAccount,
        public_key: vector<u8>,
        sui_address: address,
        label: String,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        // Version gating (HIGH-14)
        assert_object_version(&account.id);

        // Verify caller is the owner
        assert!(account.owner == ctx.sender(), ENotOwner);

        // Verify account is active
        assert!(account.active, EAccountDeactivated);

        // Validate Ed25519 public key length (must be exactly 32 bytes)
        assert!(public_key.length() == ED25519_PUBLIC_KEY_LENGTH, EInvalidPublicKeyLength);

        // Validate label length (LOW-21 / SEC-282) — labels are stored on-chain
        // for the lifetime of the account, so cap the byte length to keep
        // storage costs predictable.
        assert!(label.as_bytes().length() <= MAX_LABEL_LENGTH, ELabelTooLong);

        // Check max limit
        assert!(
            account.delegate_keys.length() < MAX_DELEGATE_KEYS,
            ETooManyDelegateKeys,
        );

        // Check key doesn't already exist
        let mut i = 0;
        let len = account.delegate_keys.length();
        while (i < len) {
            assert!(
                account.delegate_keys[i].public_key != public_key,
                EDelegateKeyAlreadyExists,
            );
            i = i + 1;
        };

        let key = DelegateKey {
            public_key,
            sui_address,
            label,
            created_at: clock.timestamp_ms(),
        };

        let account_id = object::id(account);

        event::emit(DelegateKeyAdded {
            account_id,
            public_key: key.public_key,
            sui_address: key.sui_address,
            label: key.label,
        });

        account.delegate_keys.push_back(key);
    }

    /// Remove a delegate key from the account.
    /// Only the owner can remove delegate keys.
    ///
    /// LOW-20 / SEC-281: Removal is allowed even when the account is
    /// deactivated, so the owner can purge a compromised key after freezing.
    ///
    /// * `public_key` - Ed25519 public key bytes to remove
    entry fun remove_delegate_key(
        account: &mut MemWalAccount,
        public_key: vector<u8>,
        ctx: &TxContext,
    ) {
        // Version gating (HIGH-14)
        assert_object_version(&account.id);

        // Verify caller is the owner
        assert!(account.owner == ctx.sender(), ENotOwner);

        // NOTE: deliberately no `account.active` check — see LOW-20.

        // Find and remove the key
        let mut found = false;
        let mut sui_address = @0x0;
        let mut i = 0;
        let len = account.delegate_keys.length();

        while (i < len) {
            if (account.delegate_keys[i].public_key == public_key) {
                sui_address = account.delegate_keys[i].sui_address;
                account.delegate_keys.remove(i);
                found = true;
                break
            };
            i = i + 1;
        };

        assert!(found, EDelegateKeyNotFound);

        event::emit(DelegateKeyRemoved {
            account_id: object::id(account),
            public_key,
            sui_address,
        });
    }

    // ============================================================
    // Account Activation / Deactivation
    // ============================================================

    /// Deactivate (freeze) the account.
    /// When deactivated: SEAL access is denied, delegate keys cannot be added.
    /// Only the owner can deactivate.
    ///
    /// LOW-19 / SEC-279: Calling on an already-deactivated account aborts to
    /// avoid emitting spurious `AccountDeactivated` events.
    entry fun deactivate_account(
        account: &mut MemWalAccount,
        ctx: &TxContext,
    ) {
        // Version gating (HIGH-14)
        assert_object_version(&account.id);

        assert!(account.owner == ctx.sender(), ENotOwner);
        assert!(account.active, EAccountDeactivated);
        account.active = false;

        event::emit(AccountDeactivated {
            account_id: object::id(account),
            owner: account.owner,
        });
    }

    /// Reactivate a previously deactivated account.
    /// Only the owner can reactivate.
    /// Aborts with `EAccountAlreadyActive` if the account is already active
    /// (mirror of LOW-19 idempotent guard).
    entry fun reactivate_account(
        account: &mut MemWalAccount,
        ctx: &TxContext,
    ) {
        // Version gating (HIGH-14)
        assert_object_version(&account.id);

        assert!(account.owner == ctx.sender(), ENotOwner);
        assert!(!account.active, EAccountAlreadyActive);
        account.active = true;

        event::emit(AccountReactivated {
            account_id: object::id(account),
            owner: account.owner,
        });
    }

    // ============================================================
    // Migration (HIGH-14 / SEC-303)
    // ============================================================

    /// Owner-initiated migration of a `MemWalAccount` to the current VERSION.
    /// Strict: aborts if already at VERSION.
    entry fun migrate_account(
        account: &mut MemWalAccount,
        ctx: &TxContext,
    ) {
        assert!(account.owner == ctx.sender(), ENotOwner);
        let cur = get_version(&account.id);
        assert!(cur < VERSION, EAlreadyMigrated);
        bump_version(&mut account.id, VERSION);

        event::emit(AccountMigrated {
            account_id: object::id(account),
            from: cur,
            to: VERSION,
        });
    }

    /// Admin/ops batch migration of a `MemWalAccount`. Gated by the package
    /// `UpgradeCap`, which lets the cap holder migrate accounts whose owners
    /// are unreachable.
    entry fun admin_migrate_account(
        cap: &UpgradeCap,
        account: &mut MemWalAccount,
    ) {
        assert_cap_for_this_package(cap);
        let cur = get_version(&account.id);
        assert!(cur < VERSION, EAlreadyMigrated);
        bump_version(&mut account.id, VERSION);

        event::emit(AccountMigrated {
            account_id: object::id(account),
            from: cur,
            to: VERSION,
        });
    }

    /// Migrate the shared `AccountRegistry`. Gated by the package `UpgradeCap`
    /// because there is exactly one registry and migrating it is an ops-only
    /// rollout step.
    entry fun migrate_registry(
        cap: &UpgradeCap,
        registry: &mut AccountRegistry,
    ) {
        assert_cap_for_this_package(cap);
        let cur = get_version(&registry.id);
        assert!(cur < VERSION, EAlreadyMigrated);
        bump_version(&mut registry.id, VERSION);

        event::emit(RegistryMigrated {
            registry_id: object::id(registry),
            from: cur,
            to: VERSION,
        });
    }

    // ============================================================
    // View Functions
    // ============================================================

    /// Check if a public key is an authorized delegate for this account
    public fun is_delegate(account: &MemWalAccount, public_key: &vector<u8>): bool {
        let mut i = 0;
        let len = account.delegate_keys.length();
        while (i < len) {
            if (&account.delegate_keys[i].public_key == public_key) {
                return true
            };
            i = i + 1;
        };
        false
    }

    /// Check if a Sui address is an authorized delegate for this account
    public fun is_delegate_address(account: &MemWalAccount, addr: address): bool {
        let mut i = 0;
        let len = account.delegate_keys.length();
        while (i < len) {
            if (account.delegate_keys[i].sui_address == addr) {
                return true
            };
            i = i + 1;
        };
        false
    }

    /// Get the owner address
    public fun owner(account: &MemWalAccount): address {
        account.owner
    }

    /// Get the number of delegate keys
    public fun delegate_count(account: &MemWalAccount): u64 {
        account.delegate_keys.length()
    }

    /// Get a delegate key's public key by index
    public fun delegate_key_at(account: &MemWalAccount, index: u64): &vector<u8> {
        &account.delegate_keys[index].public_key
    }

    /// Get a delegate key's Sui address by index
    public fun delegate_address_at(account: &MemWalAccount, index: u64): address {
        account.delegate_keys[index].sui_address
    }

    /// Get a delegate key's label by index
    public fun delegate_label_at(account: &MemWalAccount, index: u64): &String {
        &account.delegate_keys[index].label
    }

    /// Check if an address already has an account
    public fun has_account(registry: &AccountRegistry, addr: address): bool {
        registry.accounts.contains(addr)
    }

    /// Check if the account is active
    public fun is_active(account: &MemWalAccount): bool {
        account.active
    }

    /// MNEMO: get the designated heir, if any.
    public fun heir(account: &MemWalAccount): Option<address> {
        account.heir
    }

    /// MNEMO: get the dormancy period in milliseconds (0 = inheritance off).
    public fun dormancy_ms(account: &MemWalAccount): u64 {
        account.dormancy_ms
    }

    /// MNEMO: get the owner's last-active timestamp (epoch ms).
    public fun last_active_ms(account: &MemWalAccount): u64 {
        account.last_active_ms
    }

    /// MNEMO: whether the heir path is currently open given `now_ms`. Pure
    /// read; safe for clients to call in a dry-run to predict heir access.
    public fun heir_window_open(account: &MemWalAccount, now_ms: u64): bool {
        account.dormancy_ms > 0
            && account.heir.is_some()
            && now_ms >= account.last_active_ms + account.dormancy_ms
    }

    /// Read the on-chain version of a MemWalAccount.
    /// Returns 1 for legacy accounts created before HIGH-14 was deployed.
    public fun account_version(account: &MemWalAccount): u64 {
        get_version(&account.id)
    }

    /// Read the on-chain version of an AccountRegistry.
    /// Returns 1 for legacy registries created before HIGH-14 was deployed.
    public fun registry_version(registry: &AccountRegistry): u64 {
        get_version(&registry.id)
    }

    /// Current package VERSION constant exposed for off-chain consumers.
    public fun current_version(): u64 { VERSION }

    // ============================================================
    // Inheritance / Dead-Man's Switch (MNEMO)
    // ============================================================

    /// Internal: record owner activity by stamping `last_active_ms` to now.
    /// Called by every owner-side inheritance mutator so that any owner action
    /// keeps the dormancy timer from advancing (R2 mitigation).
    fun refresh_activity(account: &mut MemWalAccount, clock: &Clock) {
        account.last_active_ms = clock.timestamp_ms();
    }

    /// Designate (or replace) the heir who may decrypt after dormancy.
    /// Owner-only; account must be active; heir cannot be the owner.
    /// Records owner activity.
    entry fun set_heir(
        account: &mut MemWalAccount,
        heir: address,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        assert_object_version(&account.id);
        assert!(account.owner == ctx.sender(), ENotOwner);
        assert!(account.active, EAccountDeactivated);
        assert!(heir != account.owner, EHeirIsOwner);

        account.heir = option::some(heir);
        refresh_activity(account, clock);

        event::emit(HeirSet {
            account_id: object::id(account),
            owner: account.owner,
            heir,
        });
    }

    /// Remove the designated heir, disabling the heir decryption path.
    /// Owner-only. Records owner activity.
    entry fun clear_heir(
        account: &mut MemWalAccount,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        assert_object_version(&account.id);
        assert!(account.owner == ctx.sender(), ENotOwner);

        account.heir = option::none();
        refresh_activity(account, clock);

        event::emit(HeirCleared {
            account_id: object::id(account),
            owner: account.owner,
        });
    }

    /// Set the dormancy period in milliseconds. `0` disables inheritance.
    /// Owner-only; account must be active; capped at MAX_DORMANCY_MS.
    /// Records owner activity.
    ///
    /// The frontend converts the human-facing value (e.g. 90 days) to ms
    /// before calling: 90 days = 7_776_000_000 ms.
    entry fun set_dormancy(
        account: &mut MemWalAccount,
        dormancy_ms: u64,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        assert_object_version(&account.id);
        assert!(account.owner == ctx.sender(), ENotOwner);
        assert!(account.active, EAccountDeactivated);
        assert!(dormancy_ms <= MAX_DORMANCY_MS, EDormancyTooLong);

        account.dormancy_ms = dormancy_ms;
        refresh_activity(account, clock);

        event::emit(DormancySet {
            account_id: object::id(account),
            owner: account.owner,
            dormancy_ms,
        });
    }

    /// Heartbeat: record that the owner is still active, resetting the
    /// dormancy timer. Owner-only. The relayer calls this on owner sessions
    /// (search, settings change, explicit ping) — this is the build guide's
    /// "heartbeat" concept.
    entry fun touch_activity(
        account: &mut MemWalAccount,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        assert_object_version(&account.id);
        assert!(account.owner == ctx.sender(), ENotOwner);
        refresh_activity(account, clock);
    }

    /// Owner override: explicitly cancel any in-progress heir claim window by
    /// resetting the dormancy timer to now. Functionally a heartbeat, exposed
    /// under an explicit name for the "I'm back" UX (S2). Owner-only.
    entry fun abort_heir_claim(
        account: &mut MemWalAccount,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        assert_object_version(&account.id);
        assert!(account.owner == ctx.sender(), ENotOwner);
        refresh_activity(account, clock);

        event::emit(HeirClaimAborted {
            account_id: object::id(account),
            owner: account.owner,
        });
    }

    // ============================================================
    // SEAL Access Control
    // ============================================================

    /// Pure authorization decision for SEAL access at a given `now_ms`.
    ///
    /// Returns true if `caller` may decrypt the data identified by `id`:
    ///   1. Owner — caller is the account owner AND `id` targets the owner; OR
    ///   2. Delegate — caller is a registered delegate key holder; OR
    ///   3. Heir — inheritance is enabled (dormancy_ms > 0), an heir is set,
    ///      caller is that heir, `id` targets the owner, and the owner has been
    ///      inactive at least `dormancy_ms`
    ///      (now_ms >= last_active_ms + dormancy_ms).
    ///
    /// Does NOT check `active` or version — `seal_approve` enforces those (as
    /// aborts) before delegating here. Exposed publicly so off-chain callers
    /// can predict access via a dry-run.
    public fun seal_access_allowed(
        account: &MemWalAccount,
        id: &vector<u8>,
        caller: address,
        now_ms: u64,
    ): bool {
        let owner_bytes = sui::bcs::to_bytes(&account.owner);
        let id_targets_owner = has_suffix(id, &owner_bytes);

        // 1. Owner
        let is_owner = (caller == account.owner) && id_targets_owner;
        // 2. Delegate
        let is_delegate = is_delegate_address(account, caller);
        // 3. Heir, only after the dormancy window has fully elapsed
        let is_heir =
            account.dormancy_ms > 0
            && account.heir.is_some()
            && *account.heir.borrow() == caller
            && id_targets_owner
            && now_ms >= account.last_active_ms + account.dormancy_ms;

        is_owner || is_delegate || is_heir
    }

    /// SEAL policy: authorize owner OR delegate OR heir-after-dormancy.
    ///
    /// Key ID format: [package_id][bcs::to_bytes(owner_address)]
    /// Called by SEAL key servers via dry_run to verify access.
    ///
    /// Access is granted if the caller is:
    /// 1. The data owner (key ID ends with BCS(owner) + caller is owner), OR
    /// 2. A registered delegate key holder, OR
    /// 3. The designated heir, once the owner has been dormant past the
    ///    configured threshold (MNEMO inheritance).
    ///
    /// The account must be active (not frozen) and on the current VERSION.
    ///
    /// NOTE (MNEMO): the signature is intentionally identical to upstream
    /// MemWal — `(id, account, ctx)` — so the relayer's hardcoded PTB target
    /// `${packageId}::account::seal_approve` works without modification. Time
    /// is read from the TxContext epoch timestamp rather than a `Clock`
    /// argument, precisely because the relayer's PTB supplies no Clock. Epoch
    /// granularity (~24h) is far finer than needed for a multi-day dormancy
    /// window and is consensus-driven, not caller-controlled.
    entry fun seal_approve(
        id: vector<u8>,
        account: &MemWalAccount,
        ctx: &TxContext,
    ) {
        // Version gating (HIGH-14)
        assert_object_version(&account.id);

        // Account must be active
        assert!(account.active, EAccountDeactivated);

        let caller = ctx.sender();
        let now_ms = ctx.epoch_timestamp_ms();

        assert!(seal_access_allowed(account, &id, caller, now_ms), ENoAccess);
    }

    /// Compute the SEAL key ID for a given owner address.
    /// Used by clients to construct the correct key ID for encryption.
    /// Key ID = bcs::to_bytes(owner_address)
    /// (Package ID prefix is added automatically by SEAL SDK)
    public fun seal_key_id(owner: address): vector<u8> {
        sui::bcs::to_bytes(&owner)
    }

    // ============================================================
    // Internal helpers
    // ============================================================

    /// Read the version dynamic field. Returns 1 (the implicit pre-upgrade
    /// version) if the field is missing — i.e. the object was created before
    /// the version-gating upgrade.
    fun get_version(id: &UID): u64 {
        if (df::exists_with_type<vector<u8>, u64>(id, VERSION_DF_KEY)) {
            *df::borrow<vector<u8>, u64>(id, VERSION_DF_KEY)
        } else {
            1
        }
    }

    /// Set the version dynamic field. Adds the field if it does not yet exist
    /// (for newly-minted objects), otherwise updates it in place.
    fun set_version(id: &mut UID, v: u64) {
        if (df::exists_with_type<vector<u8>, u64>(id, VERSION_DF_KEY)) {
            let r = df::borrow_mut<vector<u8>, u64>(id, VERSION_DF_KEY);
            *r = v;
        } else {
            df::add(id, VERSION_DF_KEY, v);
        }
    }

    /// Bump the version dynamic field. Used by migration functions.
    fun bump_version(id: &mut UID, v: u64) { set_version(id, v) }

    /// Assert that an object's version matches the current package VERSION.
    fun assert_object_version(id: &UID) {
        assert!(get_version(id) == VERSION, EWrongVersion);
    }

    /// Assert that the supplied `UpgradeCap` belongs to this package.
    /// Compares the cap's tracked package ID against `@memwal`, which is
    /// rewritten to the original package address at publish time.
    fun assert_cap_for_this_package(cap: &UpgradeCap) {
        let cap_pkg = package::upgrade_package(cap);
        assert!(object::id_to_address(&cap_pkg) == @memwal, ENotUpgradeAuthority);
    }

    /// Check if `data` ends with `suffix`.
    /// Used for flexible key ID matching (with or without package prefix).
    fun has_suffix(data: &vector<u8>, suffix: &vector<u8>): bool {
        let data_len = data.length();
        let suffix_len = suffix.length();
        if (suffix_len > data_len) return false;
        let offset = data_len - suffix_len;
        let mut i = 0;
        while (i < suffix_len) {
            if (data[offset + i] != suffix[i]) return false;
            i = i + 1;
        };
        true
    }

    // ============================================================
    // Test helpers
    // ============================================================

    #[test_only]
    public fun test_init(ctx: &mut TxContext) {
        init(ctx);
    }

    /// Create a fake `UpgradeCap` for tests, claiming to control this package.
    /// Mirrors what `sui::package::test_publish` provides.
    #[test_only]
    public fun test_make_upgrade_cap(ctx: &mut TxContext): UpgradeCap {
        package::test_publish(object::id_from_address(@memwal), ctx)
    }

    /// Create an UpgradeCap claiming a different package, used to verify
    /// `ENotUpgradeAuthority` rejects foreign caps.
    #[test_only]
    public fun test_make_foreign_upgrade_cap(ctx: &mut TxContext): UpgradeCap {
        package::test_publish(object::id_from_address(@0xBADBAD), ctx)
    }

    /// Force an object's version dynamic field to an arbitrary value, used to
    /// simulate a legacy (pre-upgrade) object inside tests.
    #[test_only]
    public fun test_force_account_version(account: &mut MemWalAccount, v: u64) {
        set_version(&mut account.id, v);
    }

    #[test_only]
    public fun test_force_registry_version(registry: &mut AccountRegistry, v: u64) {
        set_version(&mut registry.id, v);
    }

    /// Remove the version dynamic field entirely, simulating an object created
    /// before the version-gating upgrade was published.
    #[test_only]
    public fun test_strip_account_version(account: &mut MemWalAccount) {
        if (df::exists_with_type<vector<u8>, u64>(&account.id, VERSION_DF_KEY)) {
            let _: u64 = df::remove(&mut account.id, VERSION_DF_KEY);
        }
    }

    #[test_only]
    public fun test_strip_registry_version(registry: &mut AccountRegistry) {
        if (df::exists_with_type<vector<u8>, u64>(&registry.id, VERSION_DF_KEY)) {
            let _: u64 = df::remove(&mut registry.id, VERSION_DF_KEY);
        }
    }

    // ---- MNEMO inheritance test helpers ----

    /// Directly set `last_active_ms`, bypassing owner checks and the Clock,
    /// so tests can construct precise dormancy scenarios.
    #[test_only]
    public fun test_set_last_active(account: &mut MemWalAccount, ms: u64) {
        account.last_active_ms = ms;
    }

    /// Directly set heir + dormancy, bypassing owner checks, so tests can
    /// construct inheritance states without a full setter transaction.
    #[test_only]
    public fun test_set_inheritance(
        account: &mut MemWalAccount,
        heir: address,
        dormancy_ms: u64,
    ) {
        account.heir = option::some(heir);
        account.dormancy_ms = dormancy_ms;
    }
}
