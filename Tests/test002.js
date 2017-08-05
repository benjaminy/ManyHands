var test002 = async( 'Test01', function *( scp, log )
{
    // var alice     = yield register( 'alice', 'p1', scp );
    // var bob       = yield register( 'bob', 'p2', scp );
    yield register( scp, 'alice', 'p1' );
    yield register( scp, 'bob',   'p2' );
    yield register( scp, 'carol', 'p3' );
    var alice     = yield login( scp, 'alice', 'p1' );
    var bob       = yield login( scp, 'bob',   'p2' );
    var carol     = yield login( scp, 'carol', 'p3' );
    var team_id   = yield createTeam( scp, 'ATeam', alice );
    var alice     = yield login( scp, 'alice', 'p1' );
    var step1_pub_b = yield inviteStep1( scp, 'bob',   team_id, alice );
    var step1_pub_c = yield inviteStep1( scp, 'carol', team_id, alice );
    var step2_pub_b = yield inviteStep2( scp, step1_pub_b, bob );
    var step2_pub_c = yield inviteStep2( scp, step1_pub_c, carol );
    yield inviteStep3( scp, step2_pub_b, alice );
    yield inviteStep3( scp, step2_pub_c, alice );
    yield inviteStep4( scp, step1_pub_b, bob );
    yield inviteStep4( scp, step1_pub_c, carol );
    log( 'SUCCESS' );
} );

window.onload = function() { console.log( "Ready to run test 002" ); };
