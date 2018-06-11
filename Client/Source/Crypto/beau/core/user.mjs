import {key_to_buffer, combine_typed_arrays} from "./crypto_helpers"

import  WebCrypto from "node-webcrypto-ossl";
import TextEncoder from "text-encoding";

const Encoder = new TextEncoder.TextEncoder();
const Decoder = new TextEncoder.TextDecoder('utf-8');

const WC = new WebCrypto();
const CS = WC.subtle;


export async function user(name) {
    let u = {}
    u.name = name

    u.identity_dh_keypair = await generate_dh_keypair();
    u.identity_dsa_keypair = await generate_dsa_keypair(u.identity_dh_keypair);

    u.signed_prekey = await generate_signed_prekey(u.identity_dsa_keypair.privateKey);

    u.ephemeral_key = await generate_dh_keypair();

    u.one_time_prekey = await generate_dh_keypair();

    return u;
}

async function generate_dh_keypair() {
    let keypair = await CS.generateKey(
        { name: "ECDH", namedCurve: "P-256"},
        true, ["deriveKey", "deriveBits"]
    );

    return keypair;
}

async function generate_dsa_keypair(dh_keypair) {
    let exported_dh_private_key = await CS.exportKey( "jwk", dh_keypair.privateKey );
    let exported_dh_public_key = await CS.exportKey( "jwk", dh_keypair.publicKey );

    delete exported_dh_private_key.key_ops;
    delete exported_dh_public_key.key_ops;

    let dsa_private_key = await CS.importKey(
        "jwk",
        exported_dh_private_key,
        { name: "ECDSA", namedCurve: "P-256" },
        true, ["sign"]
    );

    let dsa_public_key = await CS.importKey(
        "jwk",
        exported_dh_public_key,
        { name: "ECDSA", namedCurve: "P-256" },
        true, ["verify"]
    );

    return { publicKey: dsa_public_key, privateKey: dsa_private_key}
}

async function generate_signed_prekey(dsa_private_key) {
    let prekey = await generate_dh_keypair();

    let data_to_sign = await key_to_buffer(prekey.publicKey);

    let signature = await CS.sign(
        { name: "ECDSA", hash: {name: "SHA-256"} },
        dsa_private_key, data_to_sign
    );

    return { keypair: prekey, signature: signature };
}
