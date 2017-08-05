var test_create_3team = async( 'Test01', function *( scp, log )
{
    /* var alice     = */ yield register( scp, 'alice', 'passwordA' );
    /* var bob       = */ yield register( scp, 'bob',   'passwordB' );
    /* var carol     = */ yield register( scp, 'carol', 'passwordC' );
    var alice      = yield login( scp, 'alice', 'passwordA' );
    var bob        = yield login( scp, 'bob',   'passwordB' );
    var carol      = yield login( scp, 'carol', 'passwordC' );
    var team_id    = yield createTeam( scp, alice, 'ATeam' );
    var alice      = yield login( scp, 'alice', 'passwordA' );
    var step1B_pub = yield inviteStep1( scp, alice, 'bob',   team_id );
    var step1C_pub = yield inviteStep1( scp, alice, 'carol', team_id );
    var step2B_pub = yield inviteStep2( scp, bob,   step1B_pub );
    var step2C_pub = yield inviteStep2( scp, carol, step1C_pub );
    yield inviteStep3( scp, alice, step2B_pub );
    yield inviteStep3( scp, alice, step2C_pub );
    yield inviteStep4( scp, bob,   step1B_pub );
    yield inviteStep4( scp, carol, step1C_pub );
    /* re-login shouldn't be necessary. */
    var alice      = yield login( scp, 'alice', 'passwordA' );
    var bob        = yield login( scp, 'bob',   'passwordB' );
    var carol      = yield login( scp, 'carol', 'passwordC' );
    log( 'SUCCESS' );
    return { ua:alice, ub:bob, uc:carol, ta1:team_id };
} );

try {
    window.onload = function() { console.log( 'test_create_3team loaded.' ); };
}
catch( e ) { }
