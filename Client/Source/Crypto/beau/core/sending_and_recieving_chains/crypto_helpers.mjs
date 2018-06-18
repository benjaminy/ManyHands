import WebCrypto from "node-webcrypto-ossl";
import TextEncoder from "text-encoding";

const Encoder = new TextEncoder.TextEncoder();
const Decoder = new TextEncoder.TextDecoder('utf-8');

const iv_32 = new Uint32Array([272313578, 3325780468, 283646714, 120955213]);
const iv_val = new Uint8Array(iv_32.buffer);

let iv_root = new Uint32Array([ 4183535103, 1663654904, 3786963079, 1962665393 ]);
let iv_send = new Uint32Array([ 3855252484, 3425917560, 4268165549, 128035330 ]);
let iv_recieve = new Uint32Array([ 3855252484, 3425917560, 4268165549, 128035330 ]);

iv_root = iv_root.buffer;
iv_send = iv_send.buffer;
iv_recieve = iv_recieve.buffer;

const WC = new WebCrypto();
const CS = WC.subtle;

export function combine_typed_arrays(typed_arrays) {
    let total_number_of_bytes = 0;

    for (let i = 0; i < typed_arrays.length; i++) {
        total_number_of_bytes += typed_arrays[i].length;
    }

    let output = new Uint8Array(total_number_of_bytes);
    let offset = 0;

    for (let i = 0; i < typed_arrays.length; i++) {
        output.set(typed_arrays[i], offset);
        offset += typed_arrays[i].length;
    }

    return output.buffer;
}

export function split_signature(message_buffer) {
    let typed_array = new  Uint8Array(message_buffer)
    let total_length = typed_array.length;

    let message = typed_array.slice(0, (total_length - 32));
    let signature = typed_array.slice((total_length - 32), total_length);

    return {message: message.buffer, signature: signature.buffer};
}

export async function encrypt(json_object, secret) {
    let object_string = JSON.stringify(json_object);
    let object_buffer = Encoder.encode(object_string);
    let cbc_key = await CS.importKey(
        "raw", secret, { name: "AES-CBC" }, false, ["encrypt", "decrypt"]
    );


    let encryption = await CS.encrypt(
        { name: "AES-CBC", iv: iv_val }, cbc_key, object_buffer
    );

    return encryption;
}


export async function decrypt(message_buffer, secret) {
    let cbc_key = await CS.importKey(
        "raw", secret, { name: "AES-CBC" }, false, ["encrypt", "decrypt"]
    );

    let decryption = await CS.decrypt(
        { name: "AES-CBC", iv: iv_val }, cbc_key, message_buffer
    );

    let decoded_decryption = Decoder.decode(decryption);

    return decoded_decryption;

}

export async function sign(message_buffer, secret) {
    let sign_key = await CS.importKey(
        "raw", secret, { name: "HMAC", hash: {name: "SHA-256"} }, false, ["sign", "verify"]
    );

    let signature = await CS.sign(
        {
            name: "HMAC",
        },
        sign_key, message_buffer
    );

    return signature;
}

export async function verify(message_buffer, signature, secret) {
    let sign_key = await CS.importKey(
        "raw", secret, { name: "HMAC", hash: {name: "SHA-256"} }, false, ["sign", "verify"]
    );

    let verification = await CS.verify(
        { name: "HMAC" }, sign_key, signature, message_buffer
    );

    return verification;
}

export async function encrypt_sign(json_object, secret) {
    let encryption = await encrypt(json_object, secret);

    let signature = await sign(encryption, secret);

    let message_buffer = combine_typed_arrays(
        [new Uint8Array(encryption), new Uint8Array(signature)]
    );

    return message_buffer;

}

export async function decrypt_verify(message_buffer, secret) {
    let message_object = split_signature(message_buffer);
    let verification = await verify(
        message_object.message, message_object.signature, secret
    );

    if (verification) {
        let decryption = await decrypt(message_object.message, secret);
        return {decryption: JSON.parse(decryption), verification: verification};
    }
    else {
        return {verification: verification};
    }


}

export async function step(secret) {
    let kdf_key = await CS.importKey(
        "raw", secret, { name: "PBKDF2" }, false, ["deriveKey", "deriveBits"]
    );

    let new_secret = await CS.deriveBits(
        { "name": "PBKDF2", salt: iv_val, iterations: 1000, hash: {name: "SHA-1"} },
         kdf_key, 256
    );

    return new_secret;
}


export async function step_root(secret) {
    let kdf_key = await CS.importKey(
        "raw", secret, { name: "PBKDF2" }, false, ["deriveKey", "deriveBits"]
    );

    let new_secret = await CS.deriveBits(
        { "name": "PBKDF2", salt: iv_root, iterations: 1000, hash: {name: "SHA-1"} },
         kdf_key, 256
    );

    return new_secret;
}


export async function step_send(secret) {
    let kdf_key = await CS.importKey(
        "raw", secret, { name: "PBKDF2" }, false, ["deriveKey", "deriveBits"]
    );

    let new_secret = await CS.deriveBits(
        { "name": "PBKDF2", salt: iv_send, iterations: 1000, hash: {name: "SHA-1"} },
         kdf_key, 256
    );

    return new_secret;
}

export async function step_recieve(secret) {
    let kdf_key = await CS.importKey(
        "raw", secret, { name: "PBKDF2" }, false, ["deriveKey", "deriveBits"]
    );

    let new_secret = await CS.deriveBits(
        { "name": "PBKDF2", salt: iv_recieve, iterations: 1000, hash: {name: "SHA-1"} },
         kdf_key, 256
    );

    return new_secret;
}

async function main() {
    console.log(await WC.getRandomValues(new Uint32Array(4)))

}
