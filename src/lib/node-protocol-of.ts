/**
 * Website protocols that use another protocol's node protocol. Servers report no "fastdns": FastDNS is
 * SlowDNS under another name, offered wherever a server reports SlowDNS and created through it (the
 * same Linux user, nameserver and public key). Both are built-in, so their slugs cannot be edited.
 */
export const NODE_PROTOCOL_OF: Readonly<Record<string, string>> = { fastdns: "slowdns" };
