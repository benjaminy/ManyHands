var test01 = async( 'Test01', function *( scp, log )
{
    // var alice     = yield register( 'alice', 'p1', scp );
    // var bob       = yield register( 'bob', 'p2', scp );
    yield register( scp, 'alice', 'p1' );
    yield register( scp, 'bob', 'p2' );
    var alice     = yield login( scp, 'alice', 'p1' );
    var bob       = yield login( scp, 'bob', 'p2' );
    var team_id   = yield createTeam( scp, 'ATeam', alice );
    var alice     = yield login( scp, 'alice', 'p1' );
    var step1_pub = yield inviteStep1( scp, 'bob', team_id, alice );
    var step2_pub = yield inviteStep2( scp, step1_pub, bob );
    yield inviteStep3( scp, step2_pub, alice );
    yield inviteStep4( scp, step1_pub, bob );
    log( 'SUCCESS' );
} );

window.onload = function() { test01( null ) };
