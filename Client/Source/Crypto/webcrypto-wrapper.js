/*
 * Top Matter
 *
 * Client/Crypto/wrapper.js
 */

const C = window.crypto.subtle;

export const getRandomValues = window.crypto.getRandomValues.bind( window.crypto );

export const exportKey = C.exportKey;
