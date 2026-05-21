/// Mnemo Seal access policy.
/// Seal's threshold key servers consult this module (via the on-chain access
/// check) to decide whether to release decryption key shares to a requester.
///
/// The rule for v1 is the simplest possible: only the namespace owner can decrypt.
/// We'll layer in arbitrator/inheritance grants in later weeks if time permits.
module mnemo::policy {
    use mnemo::namespace::{Self, Namespace};

    /// Returns true iff `requester` is the owner of `ns`.
    /// Called by Seal during decryption-key issuance.
    public fun has_access(ns: &Namespace, requester: address): bool {
        namespace::owner(ns) == requester
    }
}
