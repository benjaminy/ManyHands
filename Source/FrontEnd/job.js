

function onLoad()
{
    // "Loading"
    var entId = 42; // XXX load entity ID of Job from local storage or maybe from anchor
    var datoms = query( "entid = 42" );
    var teammates = []
    var jobs = []
    var other = []
    for( var i = 0; i < datoms.length; i++ )
    {
        if( datoms[ i ].attribute == "did_it:teammate" )
            teammates.push( datoms[ i ] );
        else if( datoms[ i ].attribute == "did_it:job" )
            jobs.push( datoms[ i ] );
        else
            other.push( datoms[ i ] );
    }
    for( var i = 0; i < teammates.length; i++ )
    {
        add teammate
    }
    add date
    add notes
}
