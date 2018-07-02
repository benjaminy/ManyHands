import assert from "assert";
import * as my_crypto from "../clean/crypto_wrappers";

import WebCrypto from "node-webcrypto-ossl";
const WC = new WebCrypto();
const CS = WC.subtle;

import TextEncoder from "text-encoding";
const Encoder = new TextEncoder.TextEncoder();
const Decoder = new TextEncoder.TextDecoder('utf-8');

async function main() {
    await test_sign_verify_key();
    await test_encrypt_decrypt();
    await test_sign_verify();
    await test_encode_decode_string();
    await test_encode_decode_object();
    await test_combine_buffers();
    await test_export_import_dh_public_key();
}
main();

async function test_sign_verify_key() {
    named_log("testing signing and verifying a key using a dsa public key");

    let identity_dh = await my_crypto.generate_dh_key();
    let identity_dsa = await my_crypto.generate_dsa_key(identity_dh);

    let prekey = await my_crypto.generate_dh_key();

    let key_signature = await my_crypto.sign_key(identity_dsa.privateKey, prekey.publicKey);
    let key_verification = await my_crypto.verify_key_signature(
        identity_dsa.publicKey,
        prekey.publicKey,
        key_signature
    );

    assert(key_verification);
    success();
}

async function test_encrypt_decrypt() {
    named_log("test encrypting and decrypting a message");

    let shared_secret = await my_crypto.random_secret();
    let initial_message = "I'm running away to the circus mom!";

    let cipher_text = await my_crypto.encrypt_text(shared_secret, initial_message);
    let decryption = await my_crypto.decrypt_text(shared_secret, cipher_text);
    assert(initial_message === decryption);
    success();
}

async function test_sign_verify() {
    named_log("test signing and verifying a message");

    let shared_secret = await my_crypto.random_secret();
    let initial_message = "I'm running away to the circus mom!";

    let initial_message_buffer = my_crypto.encode_string(initial_message);

    let signature = await my_crypto.sign(shared_secret, initial_message_buffer);
    let verification = await my_crypto.verify(shared_secret, signature, initial_message_buffer);
    assert(verification);
    success();
}

async function test_encode_decode_string() {
    named_log("test encoding and decoding a string");
    let string_to_encode = "Foo Bar Baz";

    let encoded_string = my_crypto.encode_string(string_to_encode);
    let decoded_string = my_crypto.decode_string(encoded_string);


    assert(string_to_encode === decoded_string);
    success();
}

async function test_encode_decode_object() {
    named_log("test encoding and decoding an object");
    let my_object = {
        "pet": "cat",
        "age": 10,
        "carreer": "winner"
    };

    let encoded_object = my_crypto.encode_object(my_object);
    let decoded_object = my_crypto.decode_object(encoded_object);
    assert(decoded_object.pet === my_object.pet);
    assert(decoded_object.age === my_object.age);
    assert(decoded_object.carreer === my_object.carreer);
    success();
}

async function test_export_import_dh_public_key() {
    named_log("test import and export a public key");
    let dh_keypair = await my_crypto.generate_dh_key();
    let public_key = dh_keypair.publicKey;

    let key_object = await my_crypto.export_dh_key(public_key);
    let imported_key = await my_crypto.import_dh_key(key_object);

    let re_exported = await CS.exportKey("jwk", imported_key);

    assert(key_object.kty === re_exported.kty);
    assert(key_object.crv === re_exported.crv);
    assert(key_object.x === re_exported.x);
    assert(key_object.y === re_exported.y);
    success();
}

async function test_combine_buffers() {
    named_log("test combine buffer arrays");

    let string_one = "the lazy brown fox";
    let string_two = " jumps over the log";

    let buffer_one = my_crypto.encode_string(string_one);
    let buffer_two = my_crypto.encode_string(string_two);

    let combined_buffers = my_crypto.combine_buffers([buffer_one, buffer_two]);
    let decoded_combined_buffers = my_crypto.decode_string(combined_buffers)

    assert((string_one + string_two) === decoded_combined_buffers);
    success();
}

function named_log(name) {
    let cyan = '\x1b[36m%s\x1b[0m';
    console.log(cyan, "*******************************");
    console.log(cyan, name);
    console.log(cyan, "*******************************");
}

function success() {
    let green = "\x1b[32m%s\x1b[0m";
    console.log(green, "success!");
    console.log();
}
