#!/usr/bin/env node --experimental-modules

/* Top Matter */

class NotFoundError extends Error
{
    constructor()
    {
        super();
        this.name = "NotFoundError";
    }
}

class NotFoundError2 extends Error
{
    constructor()
    {
        super();
        this.type = "NotFoundError";
    }
}

function main()
{
    try {
        throw new Error( "Monkey" );
    }
    catch( err ) {
        console.log( "Name:", err.name );
    }

    try {
        throw new NotFoundError();
    }
    catch( err ) {
        console.log( "Name:", err.name );
    }

    try {
        throw new NotFoundError2();
    }
    catch( err ) {
        console.log( "Type:", err.type );
    }
}

main();
