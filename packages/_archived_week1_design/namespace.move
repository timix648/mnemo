/// User-owned object representing a Mnemo memory namespace.
/// Each user can have multiple namespaces ("work", "personal", "research", ...);
/// Seal access policies key off namespace ownership.
module mnemo::namespace {
    use std::string::{Self, String};
    use sui::event;

    /// The Namespace object. `key + store` makes it a top-level on-chain object
    /// that can be owned by an address (the most efficient access pattern).
    public struct Namespace has key, store {
        id: UID,
        owner: address,
        name: String,
        created_at_epoch: u64,
    }

    /// Emitted on creation so off-chain indexers can pick up new namespaces
    /// without polling the chain for ownership changes.
    public struct NamespaceCreated has copy, drop {
        id: ID,
        owner: address,
        name: String,
        epoch: u64,
    }

    /// Emitted on rename for the same reason.
    public struct NamespaceRenamed has copy, drop {
        id: ID,
        owner: address,
        new_name: String,
    }

    /// Create a new namespace owned by `ctx.sender()`.
    /// `name` is bytes that we expect to be valid UTF-8 (the SDK enforces).
    public entry fun create(name: vector<u8>, ctx: &mut TxContext) {
        let owner = ctx.sender();
        let name_str = string::utf8(name);
        let ns = Namespace {
            id: object::new(ctx),
            owner,
            name: name_str,
            created_at_epoch: ctx.epoch(),
        };
        event::emit(NamespaceCreated {
            id: object::id(&ns),
            owner,
            name: ns.name,
            epoch: ns.created_at_epoch,
        });
        transfer::transfer(ns, owner);
    }

    /// Rename a namespace. Move's ownership semantics already restrict this
    /// to the namespace owner (you can only get a `&mut Namespace` if you own it).
    public entry fun rename(ns: &mut Namespace, new_name: vector<u8>) {
        ns.name = string::utf8(new_name);
        event::emit(NamespaceRenamed {
            id: object::id(ns),
            owner: ns.owner,
            new_name: ns.name,
        });
    }

    // -------- Accessors (read by the Seal access policy and off-chain code) --------

    public fun owner(ns: &Namespace): address { ns.owner }
    public fun name(ns: &Namespace): &String { &ns.name }
    public fun created_at_epoch(ns: &Namespace): u64 { ns.created_at_epoch }
    public fun id(ns: &Namespace): &UID { &ns.id }
}
