/* Top Matter */

import A       from "../Utilities/act-thread";
import * as K  from "../Utilities/keyword";
import * as DA from "../Database/attribute";

const self_key_signK = K.key( ":self.key/sign" );
const self_key_dhK   = K.key( ":self.key/dh" );
const team_idK       = K.key( ":team/id" );
const team_root_keyK = K.key( ":team/root_key" );

const init_personal_UWS_DBs = A( async function init_UWS_DB( actx, storage )
{
    /* private DB */
    const self_key_sign = DA.makeAttribute(
        self_key_signK,
        DA.vtypeString,
        DA.cardinalityOne,
        "Primary signing key" );

    const self_key_dh = DA.makeAttribute(
        self_key_dhK,
        DA.vtypeString,
        DA.cardinalityOne,
        "Half of a DH key-pair; either public or private, depending on which DB this is in" );

    const team_id = DA.makeAttribute(
        team_idK,
        DA.vtypeString,
        DA.cardinalityOne,
        "A team's ID" );

    const team_root_key = DA.makeAttribute(
        team_root_keyK,
        DA.vtypeString,
        DA.cardinalityOne,
        "The key to decrypt a team's private root" );

/* public DB */

:self.key/id
:self.key/verify
:self.key/dh
:self.key/priv_root
:self/login_salt
:team/id
:team/root

} );

const init_team_UWS_DB = A( async function init_team_UWS_DB( actx, root )
{
/* team DB */

:user/id
:user/


} );
