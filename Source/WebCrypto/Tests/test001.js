function test01()
{
    var [ scp, log ] = Scope.enter( null, 'Test01' );
    var alice;
    var bob;
    var team_id_hack;
    var step1_pub;
    register( 'alice', 'p', scp )
    .then( function( _ ) { var scp = Scope.anon( scp );
        return register( 'bob', 'p', scp );
    } ).then( function( _ ) { var scp = Scope.anon( scp );
        return login( 'alice', 'p', scp );
    } ).then( function( u ) { var scp = Scope.anon( scp );
        alice = u;
        return login( 'bob', 'p', scp );
    } ).then( function( u ) { var scp = Scope.anon( scp );
        bob = u;
        return createTeam( 'ATeam', alice, scp );
    } ).then( function( team_id ) { var scp = Scope.anon( scp );
        team_id_hack = team_id;
        return login( 'alice', 'p', scp );
    } ).then( function( u ) { var scp = Scope.anon( scp );
        alice = u;
        return inviteStep1( 'bob', team_id_hack, alice, scp );
    } ).then( function( s ) { var scp = Scope.anon( scp );
        step1_pub = s;
        return inviteStep2( step1_pub, bob, scp );
    } ).then( function( accept ) { var scp = Scope.anon( scp );
        return inviteStep3( accept, alice, scp );
    } ).then( function() { var scp = Scope.anon( scp );
        return inviteStep4( step1_pub, bob, scp );
    } ).then( function() { var scp = Scope.anon( scp );
        log( 'SUCCESS' );
    } )
}

window.onload = test01;
