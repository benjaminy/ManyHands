import assert from "assert";
import WebCrypto from "node-webcrypto-ossl";

const WC = new WebCrypto();
const CS = WC.subtle;


// import * as suite from "./crypto_suite";
import * as suite from "./non_crypto_suite";

import TextEncoder from "text-encoding";
const Encoder = new TextEncoder.TextEncoder();
const Decoder = new TextEncoder.TextDecoder('utf-8');

let IV_VAL = new Uint32Array([ 4183535103, 1663654904, 3786963079, 1962665393 ]).buffer;
let IV_ROOT_VAL = new Uint32Array([ 4183535103, 1663654904, 3786963079, 1962665393 ]).buffer;

export async function sign_key(dsa_private_key, key_to_sign) {
    assert(key_to_sign.algorithm.name === "ECDH");
    assert(key_to_sign.type === "public");
    assert(dsa_private_key.algorithm.name === "ECDSA");
    assert(dsa_private_key.type === "private");

    const exported_prekey = await suite.export_key("jwk", key_to_sign);
    const data_to_sign = encode_object(exported_prekey);

    const signature = await suite.sign(
        { name: "ECDSA", hash: {name: "SHA-256"} },
        dsa_private_key, data_to_sign
    );


    return signature;
}

export async function verify_key_signature(dsa_public_key, signed_key, signature) {
    assert(new DataView(signature).byteLength > 0);
    assert(signed_key.algorithm.name === "ECDH");
    assert(signed_key.type === "public");

    assert(dsa_public_key.algorithm.name === "ECDSA");
    assert(dsa_public_key.type === "public");

    const exported_prekey = await suite.export_key("jwk", signed_key);
    const data_to_sign = encode_object(exported_prekey);


    const verify = await suite.verify(
        { name: "ECDSA", hash: {name: "SHA-256"} },
        dsa_public_key, signature, data_to_sign
    );

    return verify;
}

export async function derive_dsa_key(dh_keypair) {
    assert(dh_keypair.publicKey.algorithm.name === "ECDH");
    assert(dh_keypair.publicKey.type === "public");
    assert(dh_keypair.privateKey.algorithm.name === "ECDH");
    assert(dh_keypair.privateKey.type === "private");

    const exported_dh_private_key = await suite.export_key( "jwk", dh_keypair.privateKey );
    const exported_dh_public_key = await suite.export_key( "jwk", dh_keypair.publicKey);

    delete exported_dh_private_key.key_ops;
    delete exported_dh_public_key.key_ops;

    const dsa_private_key = await suite.import_key(
        "jwk",
        exported_dh_private_key,
        { name: "ECDSA", namedCurve: "P-256" },
        true, ["sign"]
    );

    const dsa_public_key = await suite.import_key(
        "jwk",
        exported_dh_public_key,
        { name: "ECDSA", namedCurve: "P-256" },
        true, ["verify"]
    );

    return { publicKey: dsa_public_key, privateKey: dsa_private_key}
}

export async function encrypt_buffer(secret_key, buffer) {
    assert(new DataView(secret_key).byteLength === 32);
    assert(new DataView(buffer).byteLength > 0);

    const cbc_key = await suite.import_key(
        "raw", secret_key, { name: "AES-CBC" }, false, ["encrypt", "decrypt"]
    );

    const message_encryption = await suite.encrypt(
        { name: "AES-CBC", iv: IV_VAL }, cbc_key, buffer
    );

    return message_encryption;
}

export async function encrypt_text(secret_key, plain_text) {
    assert(typeof plain_text === "string");
    assert(new DataView(secret_key).byteLength === 32);

    const text_buffer = encode_string(plain_text);

    const cbc_key = await suite.import_key(
        "raw", secret_key, { name: "AES-CBC" }, false, ["encrypt", "decrypt"]
    );

    const message_encryption = await suite.encrypt(
        { name: "AES-CBC", iv: IV_VAL }, cbc_key, text_buffer
    );

    return message_encryption;
}

export async function decrypt(secret_key, cipher_text) {
    assert(new DataView(secret_key).byteLength === 32);
    assert(new DataView(cipher_text).byteLength > 0);

    const cbc_key = await suite.import_key(
        "raw", secret_key, { name: "AES-CBC" }, false, ["encrypt", "decrypt"]
    );

    const decryption_buffer = await suite.decrypt(
        { name: "AES-CBC", iv: IV_VAL }, cbc_key, cipher_text
    );

    return decryption_buffer;
}


export async function decrypt_text(secret_key, cipher_text) {
    assert(new DataView(secret_key).byteLength === 32);
    assert(new DataView(cipher_text).byteLength > 0);

    const cbc_key = await suite.import_key(
        "raw", secret_key, { name: "AES-CBC" }, false, ["encrypt", "decrypt"]
    );

    const decryption_buffer = await suite.decrypt(
        { name: "AES-CBC", iv: IV_VAL }, cbc_key, cipher_text
    );

    const decryption_text = decode_string(decryption_buffer);
    return decryption_text;
}

export async function sign(dsa_private_key, data_to_sign) {
    assert(new DataView(data_to_sign).byteLength > 0);
    assert(dsa_private_key.algorithm.name === "ECDSA");
    assert(dsa_private_key.type === "private");

    const signature = await suite.sign(
        { name: "ECDSA", hash: {name: "SHA-256"} },
        dsa_private_key, data_to_sign
    );


    return signature;
}

export async function verify(dsa_public_key, signature, signed_data) {
    assert(dsa_public_key.type = "public");
    assert(dsa_public_key.algorithm.name = "ECDSA");
    assert(new DataView(signature).byteLength > 0);
    assert(new DataView(signed_data).byteLength > 0);

    assert(dsa_public_key.algorithm.name === "ECDSA");
    assert(dsa_public_key.type === "public");

    const verify = await suite.verify(
        { name: "ECDSA", hash: {name: "SHA-256"} },
        dsa_public_key, signature, signed_data
    );

    assert(verify);

    return verify;
}

export async function root_kdf_step(root_key, ratchet_seed) {
    assert(new DataView(root_key).byteLength >= 32);
    assert(new DataView(ratchet_seed).byteLength >= 32);

    const kdf_input = combine_buffers([root_key, ratchet_seed]);

    const kdf_key = await suite.import_key(
        "raw", kdf_input, { name: "PBKDF2" }, false, ["deriveKey", "deriveBits"]
    );

    const output = await suite.derive_bits(
        { "name": "PBKDF2", salt: IV_ROOT_VAL, iterations: 2, hash: {name: "SHA-1"} },
         kdf_key, 256
    );

    return {root_key: output, chain_key: output};

}

export async function chain_kdf_step(chain_key) {

    assert(new DataView(chain_key).byteLength >= 32);

    const kdf_key = await suite.import_key(
        "raw", chain_key, { name: "PBKDF2" }, false, ["deriveKey", "deriveBits"]
    );

    const output = await suite.derive_bits(
        { "name": "PBKDF2", salt: IV_VAL, iterations: 2, hash: {name: "SHA-1"} },
         kdf_key, 256
    );

    return {chain_key: output, message_key: output};
}

export async function generate_dh_key() {
    const keypair = await suite.generate_key(
        { name: "ECDH", namedCurve: "P-256"},
        true, ["deriveKey", "deriveBits"]
    );

    return keypair;
}

export async function derive_dh(keypair) {
    const public_key = keypair.publicKey;
    const private_key = keypair.privateKey;

    assert(public_key.algorithm.name === 'ECDH');
    assert(public_key.type === 'public');
    assert(private_key.algorithm.name === 'ECDH');
    assert(private_key.type === 'private');

    const secret = await suite.derive_bits(
        { name: "ECDH", namedCurve: "P-256", public: public_key },
        private_key, 256
    );

    return secret;
}

export async function export_dh_key(key) {
    assert("usages" in key);
    assert("extractable" in key);
    assert("type" in key);
    assert("algorithm" in key);

    const key_object = await suite.export_key( "jwk", key );
    return key_object;
}

export async function import_dh_key(key_object) {
    const imported_key = await suite.import_key(
        "jwk", key_object, { name: "ECDH", namedCurve: "P-256" },
        true, ["deriveKey", "deriveBits"]
    );

    return imported_key;
}

export async function export_dsa_key(key) {
    const key_object = await suite.export_key( "jwk", key );
    return key_object;
}

export async function import_dsa_key(key_object) {
    const imported_key = await suite.import_key(
        "jwk", key_object, { name: "ECDSA", namedCurve: "P-256" },
        true, ["verify"]
    );

    return imported_key;
}

export async function random_secret() {
    return await WC.getRandomValues(new Uint8Array(32)).buffer
}

export function encode_string(text) {
    const typed_array = Encoder.encode(text);
    const buffer = typed_array.buffer;
    return buffer;
}

export function decode_string(buffer) {
    const text = Decoder.decode(buffer);
    return text;
}

export function encode_object(input_object) {
    const object_string = JSON.stringify(input_object);
    const object_buffer = encode_string(object_string);
    return object_buffer;
}

export function decode_object(input_buffer) {
    const object_string = decode_string(input_buffer);

    const output_object = JSON.parse(object_string);
    return output_object;
}

export async function digest(incoming_buffer) {
    const hash_buffer = await suite.digest({name: "SHA-256"}, incoming_buffer);
    return hash_buffer;
}

export function combine_buffers(buffer_array) {
    assert(Array.isArray(buffer_array));
    let total_number_of_bytes = 0;

    for (let i = 0; i < buffer_array.length; i++) {
        const curr = buffer_array[i];
        assert(new DataView(curr).byteLength > 0);
        buffer_array[i] = new Uint8Array(buffer_array[i]);
        total_number_of_bytes += buffer_array[i].length;
    }

    let output = new Uint8Array(total_number_of_bytes);
    let offset = 0;

    for (let i = 0; i < buffer_array.length; i++) {
        output.set(buffer_array[i], offset);
        offset += buffer_array[i].length;
    }

    return output.buffer;

}
