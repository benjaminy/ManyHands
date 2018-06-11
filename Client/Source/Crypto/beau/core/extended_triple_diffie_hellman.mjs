import {key_to_buffer, combine_typed_arrays} from "./crypto_helpers"

import  WebCrypto from "node-webcrypto-ossl";
import TextEncoder from "text-encoding";

const Encoder = new TextEncoder.TextEncoder();
const Decoder = new TextEncoder.TextDecoder('utf-8');

const WC = new WebCrypto();
const CS = WC.subtle;

export async function x3dh_sender(key_bundle) {

}

export async function core_extended_triple_diffie_hellman(dh1_public, dh1_private,
    dh2_public, dh2_private, dh3_public, dh3_private, dh4_public, dh4_private) {
        // you cannot directly manipulate the bits

        let dh1_secret = await derive_shared_secret(dh1_public, dh1_private);
        let dh2_secret = await derive_shared_secret(dh2_public, dh2_private);
        let dh3_secret = await derive_shared_secret(dh3_public, dh3_private);
        let dh4_secret = await derive_shared_secret(dh4_public, dh4_private);

        let shared_secret = combine_typed_arrays([dh1_secret, dh2_secret, dh3_secret, dh4_secret]);

        return shared_secret;
}


async function verify_key_signature(dsa_public_key, signed_key, signature) {
    let key_data = await key_to_buffer(signed_key);

    let verify = await CS.verify(
        { name: "ECDSA", hash: {name: "SHA-256"} },
        dsa_public_key, signature, key_data
    );

    return verify;
}

export async function reciever_triple_diffie_hellman(sender, reciever) {
    let key_bundle = {}
    key_bundle.dh1 = {
        private_key: reciever.signed_prekey.keypair.privateKey,
        public_key: sender.identity_dh_keypair.publicKey
    }
    key_bundle.dh2 = {
        private_key: reciever.identity_dh_keypair.privateKey,
        public_key: sender.ephemeral_key.publicKey
    }
    key_bundle.dh3 = {
        private_key: reciever.signed_prekey.keypair.privateKey,
        public_key: sender.ephemeral_key.publicKey
    }
    key_bundle.dh4 = {
        private_key: reciever.one_time_prekey.privateKey,
        public_key: sender.ephemeral_key.publicKey
    }

    let reciever_secret = await core_extended_triple_diffie_hellman(
        key_bundle.dh1.public_key, key_bundle.dh1.private_key,
        key_bundle.dh2.public_key, key_bundle.dh2.private_key,
        key_bundle.dh3.public_key, key_bundle.dh3.private_key,
        key_bundle.dh4.public_key, key_bundle.dh4.private_key,
    );

    return reciever_secret;

}


export async function sender_triple_diffie_hellman(sender, reciever) {
    let key_bundle = {};
    key_bundle.dh1 = {
        private_key: sender.identity_dh_keypair.privateKey,
        public_key: reciever.signed_prekey.keypair.publicKey,
        reciever_key_signature: reciever.signed_prekey.signature,
        reciever_verify_key: reciever.identity_dsa_keypair.publicKey,
    }
    key_bundle.dh2 = {
        private_key: sender.ephemeral_key.privateKey,
        public_key: reciever.identity_dh_keypair.publicKey,
    }
    key_bundle.dh3 = {
        private_key: sender.ephemeral_key.privateKey,
        public_key: reciever.signed_prekey.keypair.publicKey,
    }
    key_bundle.dh4 = {
        private_key: sender.ephemeral_key.privateKey,
        public_key: reciever.one_time_prekey.publicKey,
    }

    let sender_secret = await core_extended_triple_diffie_hellman(
        key_bundle.dh1.public_key, key_bundle.dh1.private_key,
        key_bundle.dh2.public_key, key_bundle.dh2.private_key,
        key_bundle.dh3.public_key, key_bundle.dh3.private_key,
        key_bundle.dh4.public_key, key_bundle.dh4.private_key,
    );

    return sender_secret
}

export async function derive_shared_secret(public_key, private_key) {
    let derived_secret = await CS.deriveBits(
        {
            name: "ECDH",
            namedCurve: "P-256",
            public: public_key,
        },
        private_key,
        256
    );
    derived_secret = new Uint32Array(derived_secret);
    return derived_secret;
}

/*
diffie initiate (alice perspective)
diffie recieve (bob perspective)

diffiecore(6args of public private keys)

*/
