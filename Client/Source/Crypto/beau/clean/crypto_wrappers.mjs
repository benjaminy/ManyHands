import assert from "assert";

import WebCrypto from "node-webcrypto-ossl";
const WC = new WebCrypto();
const CS = WC.subtle;

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

    let exported_prekey = await CS.exportKey("jwk", key_to_sign);
    let data_to_sign = encode_object(exported_prekey);

    let signature = await CS.sign(
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

    let exported_prekey = await CS.exportKey("jwk", signed_key);
    let data_to_sign = encode_object(exported_prekey);


    let verify = await CS.verify(
        { name: "ECDSA", hash: {name: "SHA-256"} },
        dsa_public_key, signature, data_to_sign
    );

    return verify;
}

export async function generate_dsa_key(dh_keypair) {
    assert(dh_keypair.publicKey.algorithm.name === "ECDH");
    assert(dh_keypair.publicKey.type === "public");
    assert(dh_keypair.privateKey.algorithm.name === "ECDH");
    assert(dh_keypair.privateKey.type === "private");

    let exported_dh_private_key = await CS.exportKey( "jwk", dh_keypair.privateKey );
    let exported_dh_public_key = await CS.exportKey( "jwk", dh_keypair.publicKey);

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

export async function form_message_buffer(secret_key, header, message_text) {
    assert(new DataView(secret_key).byteLength === 32);
    assert(typeof message_text === "string");
    assert(typeof header === "object");

    let encryption = await encrypt_text(secret_key, message_text);

    let header_buffer = encode_object(header);
    let header_length = new DataView(header_buffer).byteLength;
    let header_length_buffer = new Uint32Array([header_length]).buffer;


    let data_to_sign = combine_buffers([header_length_buffer, header_buffer, encryption]);
    let signature = await sign(secret_key, data_to_sign);

    let output_buffer = combine_buffers([signature, data_to_sign]);

    return output_buffer;
}


export async function parse_message_buffer(input_buffer) {
// export async function parse_message_buffer(secret_key, input_buffer) {
    // assert(new DataView(secret_key).byteLength === 32);
    assert(new DataView(input_buffer).byteLength >= 36);

    let input_typed_array = new Uint8Array(input_buffer);
    let input_length = input_typed_array.length;

    let signature = input_typed_array.slice(0, 32).buffer
    let signed_data = input_typed_array.slice(32, input_length).buffer
    // await verify(secret_key, signature, signed_data);

    let header_length = new Uint32Array(input_typed_array.slice(32, 36))[0];
    let header_buffer = input_typed_array.slice(36, (36 + header_length)).buffer;
    let header = decode_object(header_buffer);

    let cipher_text = input_typed_array.slice((36 + header_length), input_length).buffer
    // let plain_text = await decrypt_text(secret_key, cipher_text);

    // TODO: js convention no quotations on keys
    return {
        "signature": signature,
        "signed_data": signed_data,
        "header": header,
        "cipher_text": cipher_text
    }
}

export async function add_public_key_to_header(header, public_key) {
    if (public_key !== undefined) {
        header.public_key = await export_dh_key(public_key);
    }
}

export async function parse_header(header) {
    let public_key = null;
    if (header.public_key) {
        public_key = await import_dh_key(header.public_key);
    }
    return { "public_key": public_key }
}

export async function encrypt_text(secret_key, plain_text) {
    assert(typeof plain_text === "string");
    assert(new DataView(secret_key).byteLength === 32);

    let text_buffer = encode_string(plain_text);

    let cbc_key = await CS.importKey(
        "raw", secret_key, { name: "AES-CBC" }, false, ["encrypt", "decrypt"]
    );

    let message_encryption = await CS.encrypt(
        { name: "AES-CBC", iv: IV_VAL }, cbc_key, text_buffer
    );

    return message_encryption;
}


export async function decrypt_text(secret_key, cipher_text) {
    assert(new DataView(secret_key).byteLength === 32);
    assert(new DataView(cipher_text).byteLength > 0);

    let cbc_key = await CS.importKey(
        "raw", secret_key, { name: "AES-CBC" }, false, ["encrypt", "decrypt"]
    );

    let decryption_buffer = await CS.decrypt(
        { name: "AES-CBC", iv: IV_VAL }, cbc_key, cipher_text
    );

    let decryption_text = decode_string(decryption_buffer);
    return decryption_text;
}

export async function sign(secret_key, data_to_sign) {
    assert(new DataView(secret_key).byteLength === 32);
    assert(new DataView(data_to_sign).byteLength > 0);

    let sign_key = await CS.importKey(
        "raw", secret_key, { name: "HMAC", hash: {name: "SHA-256"} }, false, ["sign", "verify"]
    );

    let signature = await CS.sign(
        { name: "HMAC" }, sign_key, data_to_sign
    );

    return signature;
}

export async function verify(secret_key, signature, signed_data) {
    assert(new DataView(secret_key).byteLength === 32);
    assert(new DataView(signed_data).byteLength > 0);
    assert(new DataView(signature).byteLength === 32);

    let sign_key = await CS.importKey(
        "raw", secret_key, { name: "HMAC", hash: {name: "SHA-256"} }, false, ["sign", "verify"]
    );

    let verification = await CS.verify(
        { name: "HMAC" }, sign_key, signature, signed_data
    );

    assert(verification);
    return verification;
}

export async function root_kdf_step(root_key, ratchet_seed) {
    assert(new DataView(root_key).byteLength >= 32);
    assert(new DataView(ratchet_seed).byteLength >= 32);

    let kdf_input = combine_buffers([root_key, ratchet_seed]);

    let kdf_key = await CS.importKey(
        "raw", kdf_input, { name: "PBKDF2" }, false, ["deriveKey", "deriveBits"]
    );

    let output = await CS.deriveBits(
        { "name": "PBKDF2", salt: IV_ROOT_VAL, iterations: 2, hash: {name: "SHA-1"} },
         kdf_key, 256
    );

    return {root_key: output, chain_key: output};

}

export async function chain_kdf_step(chain_key) {

    assert(new DataView(chain_key).byteLength >= 32);

    let kdf_key = await CS.importKey(
        "raw", chain_key, { name: "PBKDF2" }, false, ["deriveKey", "deriveBits"]
    );

    let output = await CS.deriveBits(
        { "name": "PBKDF2", salt: IV_VAL, iterations: 2, hash: {name: "SHA-1"} },
         kdf_key, 256
    );

    return {chain_key: output, message_key: output};
}


export async function generate_dh_key() {
    let keypair = await CS.generateKey(
        { name: "ECDH", namedCurve: "P-256"},
        true, ["deriveKey", "deriveBits"]
    );

    return keypair;
}

export async function derive_dh(public_key, private_key) {
    assert(public_key.algorithm.name === 'ECDH');
    assert(public_key.type === 'public');
    assert(private_key.algorithm.name === 'ECDH');
    assert(private_key.type === 'private');

    let secret = await CS.deriveBits(
        { name: "ECDH", namedCurve: "P-256", public: public_key },
        private_key, 256
    );

    return secret;
}

export async function export_dh_key(key) {
    let key_object = await CS.exportKey( "jwk", key );
    return key_object;
}

export async function import_dh_key(key_object) {
    let imported_key = await CS.importKey(
        "jwk", key_object, { name: "ECDH", namedCurve: "P-256" },
        true, ["deriveKey", "deriveBits"]
    );

    return imported_key;
}

export async function export_dsa_key(key) {
    let key_object = await CS.exportKey( "jwk", key );
    return key_object;
}

export async function import_dsa_key(key_object) {
    let imported_key = await CS.importKey(
        "jwk", key_object, { name: "ECDSA", namedCurve: "P-256" },
        true, ["deriveKey", "deriveBits"]
    );

    return imported_key;
}

export async function random_secret() {
    let typed_array = await WC.getRandomValues(new Uint8Array(32))
    let typed_buffer = typed_array.buffer;
    return typed_buffer;
}

export function encode_string(text) {
    let typed_array = Encoder.encode(text);
    let buffer = typed_array.buffer;
    return buffer;
}

export function decode_string(buffer) {
    let text = Decoder.decode(buffer);
    return text;
}

export function encode_object(input_object) {
    let object_string = JSON.stringify(input_object);
    let object_buffer = encode_string(object_string);
    return object_buffer;
}

export function decode_object(input_buffer) {
    let object_string = decode_string(input_buffer);
    let output_object = JSON.parse(object_string);
    return output_object;
}

export function combine_buffers(buffer_array) {
    assert(Array.isArray(buffer_array));
    let total_number_of_bytes = 0;

    for (let i = 0; i < buffer_array.length; i++) {
        let curr = buffer_array[i];
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
