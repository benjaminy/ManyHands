function test01()
{
    var [ scp, log ] = Scope.enter( null, 'Test01' );
    var alice;
    var bob;
    var team_id_hack;
    var step1_pub;
    register( 'alice', 'p', scp )
    .then( function( _ ) {
        return register( 'bob', 'p', scp );
    } ).then( function( _ ) {
        return login( 'alice', 'p', scp );
    } ).then( function( u ) {
        alice = u;
        return login( 'bob', 'p', scp );
    } ).then( function( u ) {
        bob = u;
        return createTeam( 'ATeam', alice, scp );
    } ).then( function( team_id ) {
        team_id_hack = team_id;
        return login( 'alice', 'p', scp );
    } ).then( function( u ) {
        alice = u;
        return inviteStep1( 'bob', team_id_hack, alice, scp );
    } ).then( function( s ) {
        step1_pub = s;
        return inviteStep2( step1_pub, bob, scp );
    } ).then( function( accept ) {
        return inviteStep3( accept, alice, scp );
    } ).then( function() {
        return inviteStep4( step1_pub, bob, scp );
    } ).then( function() {
        log( 'SUCCESS' );
    } )
}
