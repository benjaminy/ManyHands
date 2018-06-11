import {user} from "./user";
import {line_beak, named_beak} from "./debug_helpers";
import {key_to_buffer} from "./crypto_helpers";
import {x3dh_sender} from "./extended_triple_diffie_hellman";
import {core_extended_triple_diffie_hellman} from "./extended_triple_diffie_hellman";
import {reciever_triple_diffie_hellman} from "./extended_triple_diffie_hellman";
import {sender_triple_diffie_hellman} from "./extended_triple_diffie_hellman";

import  WebCrypto from "node-webcrypto-ossl";
import TextEncoder from "text-encoding";

const Encoder = new TextEncoder.TextEncoder();
const Decoder = new TextEncoder.TextDecoder('utf-8');

const WC = new WebCrypto();
const CS = WC.subtle;


async function test_create_new_user() {
    // Verifies that all keys are present and of correct type
    let alice = await user("alice");
    named_beak("identity_keys");
    console.log(alice.identity_dh_keypair);
    line_beak();
    console.log(alice.identity_dsa_keypair);
    named_beak("signed_prekey");
    console.log(alice.signed_prekey);
    named_beak("ephemeral_key");
    console.log(alice.ephemeral_key);
    named_beak("one_time_prekey");
    console.log(alice.one_time_prekey);
}

async function test_verify_signed_prekey() {
    // Verifies that signed prekey can be verified with dsa publicKey
    let alice = await user("alice");

    let signed_prekey_data = await key_to_buffer(alice.signed_prekey.keypair.publicKey);

    let verify_signed_key = await CS.verify(
        { name: "ECDSA", hash: {name: "SHA-256"}},
        alice.identity_dsa_keypair.publicKey,
        alice.signed_prekey.signature,
        signed_prekey_data
    );

    console.log(verify_signed_key);

}

async function triple_diffie_hellman() {
    let alice = await user("alice");
    let bob = await user("bob");

    let sender_sercret = await sender_triple_diffie_hellman(alice, bob);

    console.log(sender_sercret);

    let bob_secret = await reciever_triple_diffie_hellman(alice, bob);
    console.log(bob_secret);
}
triple_diffie_hellman();
