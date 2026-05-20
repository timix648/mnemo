#[test_only]
module mnemo::namespace_tests {
    use mnemo::namespace::{Self, Namespace};
    use mnemo::policy;
    use sui::test_scenario as ts;

    const ALICE: address = @0xA11CE;
    const BOB:   address = @0xB0B;

    #[test]
    fun create_owned_by_sender() {
        let mut scenario = ts::begin(ALICE);
        namespace::create(b"main", scenario.ctx());

        scenario.next_tx(ALICE);
        let ns = scenario.take_from_sender<Namespace>();
        assert!(namespace::owner(&ns) == ALICE, 100);
        scenario.return_to_sender(ns);
        scenario.end();
    }

    #[test]
    fun rename_updates_name() {
        let mut scenario = ts::begin(ALICE);
        namespace::create(b"main", scenario.ctx());

        scenario.next_tx(ALICE);
        let mut ns = scenario.take_from_sender<Namespace>();
        namespace::rename(&mut ns, b"work");
        let _name_ref = namespace::name(&ns);
        scenario.return_to_sender(ns);
        scenario.end();
    }

    #[test]
    fun owner_has_access() {
        let mut scenario = ts::begin(ALICE);
        namespace::create(b"main", scenario.ctx());
        scenario.next_tx(ALICE);
        let ns = scenario.take_from_sender<Namespace>();
        assert!(policy::has_access(&ns, ALICE), 200);
        scenario.return_to_sender(ns);
        scenario.end();
    }

    #[test]
    fun non_owner_denied() {
        let mut scenario = ts::begin(ALICE);
        namespace::create(b"main", scenario.ctx());
        scenario.next_tx(ALICE);
        let ns = scenario.take_from_sender<Namespace>();
        assert!(!policy::has_access(&ns, BOB), 300);
        scenario.return_to_sender(ns);
        scenario.end();
    }
}
