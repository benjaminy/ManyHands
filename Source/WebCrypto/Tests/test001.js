var test01 = async( 'Test01', function *( scp, log )
{
    /* var alice     = */ yield register( scp, 'alice', 'p1' );
    /* var bob       = */ yield register( scp, 'bob', 'p2' );
    var alice     = yield login( scp, 'alice', 'p1' );
    var bob       = yield login( scp, 'bob', 'p2' );
    var team_id   = yield createTeam( scp, alice, 'ATeam' );
    var alice     = yield login( scp, 'alice', 'p1' );
    var step1_pub = yield inviteStep1( scp, alice, 'bob', team_id );
    var step2_pub = yield inviteStep2( scp, bob, step1_pub );
    yield inviteStep3( scp, alice, step2_pub );
    yield inviteStep4( scp, bob, step1_pub );
    log( 'SUCCESS' );
} );

window.onload = function() { test01( null ) };
