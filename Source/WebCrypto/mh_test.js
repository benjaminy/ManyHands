function test01()
{
    var log_ctx = new LogEnv( [], 'Test01' );
    var alice;
    var bob;
    var team_id_hack;
    var step1_pub;
    register( 'alice', 'p', log_ctx )
    .then( function( _ ) {
        return register( 'bob', 'p', log_ctx );
    } ).then( function( _ ) {
        return login( 'alice', 'p', log_ctx );
    } ).then( function( u ) {
        alice = u;
        return login( 'bob', 'p', log_ctx );
    } ).then( function( u ) {
        bob = u;
        return createTeam( 'ATeam', alice, log_ctx );
    } ).then( function( team_id ) {
        team_id_hack = team_id;
        return login( 'alice', 'p', log_ctx );
    } ).then( function( u ) {
        alice = u;
        return inviteStep1( 'bob', team_id_hack, alice, log_ctx );
    } ).then( function( s ) {
        step1_pub = s;
        return inviteStep2( step1_pub, bob, log_ctx );
    } ).then( function( accept ) {
        return inviteStep3( accept, alice, log_ctx );
    } ).then( function() {
        return inviteStep4( step1_pub, bob, log_ctx );
    } ).then( function( blah ) {
        log( 'Finally', blah );
    } )
}
