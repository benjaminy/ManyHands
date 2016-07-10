/*
 *
 */

var getElemId     = document.getElementById.bind( document );
var createElement = document.createElement.bind( document );

var [ elemUID, elemPass, elemLoggedIn, elemTeamName, elemInvite, elemInviteName,
      elemInviteInput, elemTeamSelect ] =
    [ 'IdUserId', 'IdPasswd', 'IdLoggedIn', 'IdTeamName', 'IdInvite', 'IdInviteName',
      'IdInviteInput', 'IdTeamSelect' ]
    .map( getElemId );

var logged_in_user = null;

function removeChildren( elem )
{
    while( elem.firstChild )
    {
        elem.removeChild( elem.firstChild );
    }
}

function onRegisterReq()
{
    async( 'RegReq', function *( scp, log )
    {
        var name   = elemUID.value;
        var passwd = elemPass.value;
        try
        {
            var user = yield register( name, passwd );
            alert( 'Registration successful' );
        }
        catch( err )
        {
            log( 'Error during registration', err );
            if( err instanceof NameNotAvailableError )
            {
                alert( 'The username "'+name+'" is already registered' );
            }
        }
    } )( null );
}

function onLoginReq()
{
    async( 'LoginReq', function *( scp, log )
    {
        try
        {
            var user = yield login( elemUID.value, elemPass.value );
            logged_in_user = user;
            elemLoggedIn.innerText = ''+name+' '+user.cloud_text;
            removeChildren( elemTeamSelect );
            var e = createElement( 'option' );
            e.innerHTML = '! No Team Selected';
            e.value = 'None';
            elemTeamSelect.appendChild( e );
            for( team_id in user.teams )
            {
                var team = user.teams[ team_id ];
                var e = createElement( 'option' );
                e.innerHTML = team.name + ' (' + team_id + ')';
                e.value = team_id;
                elemTeamSelect.appendChild( e );
            }
        }
        catch( err )
        {
            log( 'Error during login', err );
            if( err instanceof NotFoundError )
            {
                alert( 'Login ID not found' );
            }
            else if( err instanceof AuthenticationError )
            {
                alert( 'Wrong password' );
            }
        }
    } )( null );
}

function onCreateTeam()
{
    if( !logged_in_user )
    {
        alert( 'Must login first' );
        return;
    }
    alert( elemTeamName.value );
    return createTeam( elemTeamName.value, logged_in_user )
    .catch( function( err ) {
        log( 'Error during team creation', err );
    } )
}

function onInvite()
{
    async( 'Invite', function *( scp, log )
    {
        if( !logged_in_user /* Possibly more sanity checking */ )
        {
            alert( 'Must login first' );
            return;
        }
        var team_id = elemTeamSelect.value;
        if( !( team_id in logged_in_user.teams ) )
        {
            alert( 'Must select valid team' );
            return;
        }
        try
        {
            elemInvite.innerText = yield inviteStep1(
                elemInviteName.value, team_id, logged_in_user );
        }
        catch( err )
        {
            log( 'Error during invitation', err );
        }
    } )( null );
}

function onInviteAccept()
{
    async( 'InviteAccept', function *( scp, log )
    {
        if( !logged_in_user /* Possibly more sanity checking */ )
        {
            alert( 'Must login first' );
            return;
        }
        elemInvite.innerText = yield inviteStep2( elemInviteInput.value, logged_in_user );
    } )( null );
}

function onInviteAddToTeam()
{
    if( !logged_in_user /* Possibly more sanity checking */ )
    {
        alert( 'Must login first' );
        return;
    }
    return inviteStep3( elemInviteInput.value, logged_in_user );
}
