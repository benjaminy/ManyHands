function test01()
{
    var alice = null;
    var bob = null;
    var team_id_hack = null;
    register( 'alice', 'p' )
    .then( function( _ ) {
        return register( 'bob', 'p' );
    } ).then( function( _ ) {
        return login( 'alice', 'p' );
    } ).then( function( u ) {
        alice = u;
        return login( 'bob', 'p' );
    } ).then( function( u ) {
        bob = u;
        return createTeam( 'ATeam', alice );
    } ).then( function( team_id ) {
        team_id_hack = team_id;
        return login( 'alice', 'p' );
    } ).then( function( u ) {
        alice = u;
        return makeInvite( 'bob', team_id_hack, alice );
    } ).then( function( invite ) {
        return inviteAccept( invite, bob );
    } ).then( function( accept ) {
        return inviteAddToTeam( accept, alice );
    } ).then( function( blah ) {
        log( 'Finally', blah );
    } )
}
