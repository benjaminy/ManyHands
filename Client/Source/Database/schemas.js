/*
 * Top Matter
 */

define( [ 'DB' ], function ( DB ) {
} ); // DELETEME

/*
 * This file contains schemas (i.e. attribute definitions) for the
 * various flavors of databases used in ManyHands:
 * - User (public and private)
 * - Team (public and private)
 */

try {
    console.log( 'Loading schemas module' );
}
catch( err ) {}

const m = DB.makeAttribute;

/* TODO: tease apart core protocol attributes (United We Stand) from
 * application attributes (Many Hands) */

const user_private =
[
    m( ':team/dir',
       ':db.type/string',
       ':db.cardinality/one',
       "The name of the directory for this team's data",
       ':db.unique/value' ),

    m( ':team/name',
       ':db.type/string',
       ':db.cardinality/one',
       "This team's name" ),

    m( ':user.key/dh_pub',
       ':db.type/string',
       ':db.cardinality/one',
       "A D-H key exchange public key" ),

    m( ':user.key/dh_priv',
       ':db.type/string',
       ':db.cardinality/one',
       "A D-H key exchange private key" ),

    m( ':user.key/verify',
       ':db.type/string',
       ':db.cardinality/one',
       "A (public) verification key" ),

    m( ':user.key/sign',
       ':db.type/string',
       ':db.cardinality/one',
       "A (private) signing key" ),

    m( ':user.key/symmetric',
       ':db.type/string',
       ':db.cardinality/one',
       "A symmetric key" ),

    m( ':user.key/id',
       ':db.type/long',
       ':db.cardinality/one',
       "This key's identifier; each key (or key-pair) has an arbitrary unique id" ),

    m( ':invitation/id',
       ':db.type/string',
       ':db.cardinality/one',
       "The id of an invitation, or something" )
];

const user_public =
[
    m( ':user.key/dh_pub',
       ':db.type/string',
       ':db.cardinality/one',
       "A D-H key exchange public key" ),

    m( ':user.key/verify',
       ':db.type/string',
       ':db.cardinality/one',
       "A (public) verification key" ),

    m( ':user.key/id',
       ':db.type/long',
       ':db.cardinality/one',
       "This key's identifier; each key (or key-pair) has an arbitrary unique id" )
];

const team_private =
[
    m( ':teammate/id',
       ':db.type/string',
       ':db.cardinality/one',
       "A user's arbitrary unique id" ),

    m( ':teammate/name',
       ':db.type/string',
       ':db.cardinality/one',
       "A user's name" ),
];

const team_public =
[

];
