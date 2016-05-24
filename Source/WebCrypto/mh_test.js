function test01()
{
    var alice = null;
    var bob = null;
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
    } ).then( function( _ ) {
        return makeInvite( 'bob', 'ATeam', alice );
    } ).then( function( invite ) {
        return inviteAccept( invite, bob );
    } ).then( function( acc ) {
        return inviteComplete( acc, alice );
    } ).then( function( blah ) {
        log( 'Finally', blah );
    } )
}
