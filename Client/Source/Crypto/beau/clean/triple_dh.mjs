import * as crypto from "../clean/crypto_wrappers";

import assert from "assert";

export async function sender_triple_diffie_hellman(sender_init_keys, reciever_init_keys) {
    assert(sender_init_keys.id_dh.type === "private");
    assert(sender_init_keys.id_dsa.type === "private");

    assert(reciever_init_keys.id_dh.type === "public");
    assert(reciever_init_keys.id_dsa.type === "public");

    let dh1 = {};

    let prekey_verification = await crypto.verify_key_signature(
        reciever_init_keys.id_dsa,
        reciever_init_keys.prekey,
        reciever_init_keys.prekey_signature
    );

    assert(prekey_verification);
    dh1.publicKey = reciever_init_keys.prekey;
    dh1.privateKey = sender_init_keys.id_dh;

    let dh2 = {};

    let ephemeral_key = await crypto.generate_dh_key();

    dh2.publicKey = reciever_init_keys.id_dh;
    dh2.privateKey = ephemeral_key.privateKey;

    let dh3 = {}

    dh3.publicKey = reciever_init_keys.prekey;
    dh3.privateKey = ephemeral_key.privateKey;

    let dh4 = {}

    // TODO: This is only taking the first prekey from the prekey array... meaning every sender
    // to a reciever is using the same otpk as the other senders.
    // For now, it might make sense to randomly pick an index to use for the otpk
    // Then the reciever simply uses that index, but doesn't delete the otpk.
    dh4.publicKey = reciever_init_keys.otpks[0];
    dh4.privateKey = ephemeral_key.privateKey;

    let shared_secret = await core_triple_diffie_hellman(dh1, dh2, dh3, dh4);

    return {shared_secret: shared_secret, ephemeral_public_key: ephemeral_key.publicKey};

}

export async function reciever_triple_diffie_hellman(sender_id_dh, ephemeral_public_key, reciever_init_keys) {
    let dh1 = {};
    dh1.publicKey = sender_id_dh;
    dh1.privateKey = reciever_init_keys.prekey;

    let dh2 = {};
    dh2.publicKey = ephemeral_public_key;
    dh2.privateKey = reciever_init_keys.id_dh;

    let dh3 = {};
    dh3.publicKey = ephemeral_public_key;
    dh3.privateKey = reciever_init_keys.prekey;

    let dh4 = {};
    dh4.publicKey = ephemeral_public_key;
    dh4.privateKey = reciever_init_keys.otpks[0];

    let shared_secret = await core_triple_diffie_hellman(dh1, dh2, dh3, dh4);
    return shared_secret;
}

export async function core_triple_diffie_hellman(...keypairs) {

    const secrets = await Promise.all(keypairs.map(crypto.derive_dh));

    let shared_secret = await crypto.combine_buffers(secrets);
    return shared_secret;

}
