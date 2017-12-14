/* Top Matter */

import * as DA from "../Database/attribute";

/* private DB */
const self_key_sign = DA.makeAttribute(
    ":self.key/sign",
    DA.vtypeString,
    DA.cardinalityOne,
    "Primary signing key" );

const self_key_dh = DA.makeAttribute(
    ":self.key/dh",
    DA.vtypeString,
    DA.cardinalityOne,
    "Half of a DH key-pair; either public or private, depending on which DB this is in" );

const team_id = DA.makeAttribute(
    ":team/id",
    DA.vtypeString,
    DA.cardinalityOne,
    "A team's ID" );

const team_root_key = DA.makeAttribute(
    ":team/root_key",
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

/* team DB */

:user/id
:user/
