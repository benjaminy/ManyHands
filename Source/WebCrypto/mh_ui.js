/*
 *
 */

var getElemId = document.getElementById.bind( document );

var [ elemUID, elemPass, elemLoggedIn, elemTeamName, elemInvite, elemInviteName,
      elemInviteTeam, elemInviteInput ] =
    [ 'IdUserId', 'IdPasswd', 'IdLoggedIn', 'IdTeamName', 'IdInvite', 'IdInviteName',
      'IdInviteTeam', 'IdInviteInput' ]
    .map( getElemId );

var logged_in_user = null;

function onRegisterReq()
{
    var name   = elemUID.value;
    var passwd = elemPass.value;
    return register( name, passwd )
    .then( function( user ) {
        alert( 'Registration successful' );
    } ).catch( function( err ) {
        log( 'Error during registration', err );
        if( err instanceof NameNotAvailableError )
        {
            alert( 'The username "'+name+'" is already registered' );
        }
    } );
}

function onLoginReq()
{
    return login( elemUID.value, elemPass.value )
    .then( function( user ) {
        logged_in_user = user;
        elemLoggedIn.innerText = ''+name+' '+user.cloud_text;
    } ).catch( function( err ) {
        log( 'Error during login', err );
        if( err instanceof NotFoundError )
        {
            alert( 'Login ID not found' );
        }
        else if( err instanceof AuthenticationError )
        {
            alert( 'Wrong password' );
        }
    } );
}

function onCreateTeam()
{
    if( !logged_in_user )
    {
        alert( 'Must login first' );
        return;
    }
    return createTeam( elemTeamName.value, logged_in_user )
    .catch( function( err ) {
        log( 'Error during team creation', err );
    } )
}

function onInvite()
{
    if( !logged_in_user /* Possibly more sanity checking */ )
    {
        alert( 'Must login first' );
        return;
    }
    return makeInvite( elemInviteName.value, elemInviteTeam.value, logged_in_user )
    .then( function( i ) {
        elemInvite.innerText = i;
    } ).catch( function( err ) {
        log( 'Error during invitation', err );
    } );
}

function onInviteAccept()
{
    if( !logged_in_user /* Possibly more sanity checking */ )
    {
        alert( 'Must login first' );
        return;
    }
    return inviteAccept( elemInviteInput.value, logged_in_user )
    .then( function( i ) {
        elemInvite.innerText = i;
    } );
}

function onInviteComplete()
{
    if( !logged_in_user /* Possibly more sanity checking */ )
    {
        alert( 'Must login first' );
        return;
    }
    return inviteComplete( elemInviteInput.value, logged_in_user );
}
