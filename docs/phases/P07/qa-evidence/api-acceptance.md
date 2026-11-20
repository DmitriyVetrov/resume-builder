# P07 API acceptance against the running system (2026-11-05)

```text
signing up users (the verification mail waits for the one-minute worker)
PASS AC-P07-01 create stores a mix of all section types, several of one type, shuffled and hidden, unchanged
PASS AC-P07-01 read returns it JSON-equal and in order
PASS AC-P07-01 all-empty document saves
PASS AC-P07-01 start > end saves with date_range_inverted at the pointer
PASS AC-P07-01 unknown property: 400 at (root) with unknown_property
PASS AC-P07-01 wrong type: 400 at /accentPreset with type
PASS AC-P07-01 content not matching type: 400 at /sections/0/content/items with required
PASS AC-P07-01 inline with two paragraphs: 400 at /sections/0/content/body with max_items
PASS AC-P07-01 inline with no paragraph: 400 at /sections/0/content/body with min_items
PASS AC-P07-01 nested list: 400 at /sections/0/content/items/0/text/0/kind with enum
PASS AC-P07-01 bad enum: 400 at /templateId with enum
PASS AC-P07-01 bad date: 400 at /sections/0/content/entries/0/start/month with maximum
PASS AC-P07-01 disallowed URL scheme: 400 at /header/contacts/0/url with pattern
PASS AC-P07-02 100 sections: at the bound 200, one over 400 max_items
PASS AC-P07-02 100 entries: at the bound 200, one over 400 max_items
PASS AC-P07-02 100 list items: at the bound 200, one over 400 max_items
PASS AC-P07-02 20 contacts: at the bound 200, one over 400 max_items
PASS AC-P07-02 full name of 120 emoji: at the bound 200, one over 400 max_length
PASS AC-P07-02 50 000 emoji pass, 50 001 fail
PASS AC-P07-02 body over 1 MB is 413
PASS AC-P07-02 depth 65 is malformed_request
PASS AC-P07-02 parallel creates at 199 of 200 end at exactly 200, the rest limit_reached
PASS AC-P07-02 trashed still counts: the 201st is 409
PASS AC-P07-03 summaries only, newest first, no-store
PASS AC-P07-03 paging has no gap or repeat
PASS AC-P07-03 bad limit 400 location query
PASS AC-P07-03 bad state 400
PASS AC-P07-03 another user's cursor and another query's cursor are 400
PASS AC-P07-07 getResume has ETag and no-store
PASS AC-P07-07 missing and malformed IDs are 404
PASS AC-P07-05 rename through the PUT changes only the title
PASS AC-P07-05 title of 151 is rejected by the API too
PASS AC-P07-06 trash sets deletedAt, purgeAt +30 days, version +1
PASS AC-P07-06 trashed is readable
PASS AC-P07-07 trashed read keeps ETag and no-store
PASS AC-P07-06 writes on a trashed resume answer resume_trashed
PASS AC-P07-06 the trash lists it
PASS AC-P07-06 restore clears both, version +1
PASS AC-P07-06 restore and purge of an active resume answer resume_not_trashed
PASS AC-P07-08 missing If-Match 428
PASS AC-P07-08 If-Match '*' is 400 location header
PASS AC-P07-08 If-Match '"4", "5"' is 400 location header
PASS AC-P07-08 If-Match 'W/"4"' is 400 location header
PASS AC-P07-08 If-Match '4' is 400 location header
PASS AC-P07-08 stale 412 has currentVersion and updatedAt and no content
PASS AC-P07-08 eight parallel writers: one 200, seven 412
PASS AC-P07-08 version moved by exactly one
PASS AC-P07-08 durable write concern: see MongoResumeStore.DurableWriteConcern (C03) and the replica set answers
PASS AC-P07-09 create replay: same status, Location, ETag, one resume
PASS AC-P07-09 same key, different body is 422
PASS AC-P07-09 missing key 400, malformed key 400
PASS AC-P07-09 document replay answers the same, no false 412, no write
PASS AC-P07-09 key order does not change the hash
PASS AC-P07-09 document with a different body 422 and nothing changes
PASS AC-P07-09 multipart retry with a new boundary replays
PASS AC-P07-09 multipart with different bytes is 422
PASS AC-P07-09 parallel twin writes: all 200, one version step
PASS AC-P07-09 parallel creates with one key: one resume; any duplicate in flight is 409 with Retry-After
     burst statuses [201, 409, 409, 409, 409, 409, 409, 409]
PASS AC-P07-09 keys are owner-scoped
PASS AC-P07-10 all 15 operations answer 401 to an anonymous caller
PASS AC-P07-10 user B with A's IDs: 404 on all 13
PASS AC-P07-10 another user's copy and photo source are 404
PASS AC-P07-10 A's resume, snapshot and blobs are unchanged
PASS AC-P07-10 all 9 unsafe operations answer 403 csrf_token_invalid without the token
PASS AC-P07-10 no request can set a server-owned field
PASS AC-P07-11 JPEG detected from its bytes although the part says text/html; default crop is the largest centred square
PASS AC-P07-11 PNG detected from its bytes although the part says text/html; default crop is the largest centred square
PASS AC-P07-11 WebP detected from its bytes although the part says text/html; default crop is the largest centred square
PASS AC-P07-11 GIF magic is 415 even with a declared image type
PASS AC-P07-11 undecodable is 400 photo_invalid
PASS AC-P07-11 over 8000 px per side is 400 photo_invalid
PASS AC-P07-11 over 40 MP is 400 photo_invalid
PASS AC-P07-11 exactly 5 MB passes (1 048 576 bytes per MB), and the padding is gone
PASS AC-P07-11 5 MB + 1 is 413
PASS AC-P07-11 6 MB + 1 body on real Kestrel is 413 with a problem
PASS AC-P07-11 a chunked body over 6 MB on real Kestrel is 413 with a problem
PASS AC-P07-11 the EXIF fixture carries its marker
PASS AC-P07-11 no EXIF or GPS in the master
PASS AC-P07-11 no EXIF or GPS in the rendition
PASS AC-P07-11 orientation 6 is applied to the pixels
PASS AC-P07-11 trailing polyglot bytes are gone
PASS AC-P07-11 rendition is a 600 px square JPEG
PASS AC-P07-11 a small crop is not upscaled
PASS AC-P07-11 transparency is flattened on white
PASS AC-P07-11 crop regenerates the rendition only; master bytes unchanged
PASS AC-P07-11 non-square crop is 400 crop_not_square
PASS AC-P07-11 out-of-bounds crop is 400 crop_out_of_bounds
PASS AC-P07-11 GET carries private, no-cache, a byte ETag, nosniff
PASS AC-P07-11 If-None-Match answers 304
PASS AC-P07-11 images read when trashed
PASS AC-P07-04 copy duplicates the document under new IDs at version 1 with its own photo ID
PASS AC-P07-04 the copy's photo has an independent lifecycle
PASS AC-P07-04 copying a trashed source is 409, a foreign one 404
PASS AC-P07-12 an automatic snapshot of the first write
PASS AC-P07-12 no second one within ten minutes
PASS AC-P07-12 before_export 201 then 200, version unchanged, expiresAt +30 days
PASS AC-P07-12 get returns the document
PASS AC-P07-12 foreign snapshot read is 404
PASS AC-P07-13 replacing a photo ledgers the old one in Mongo and Blob, then removes its blobs
PASS AC-P07-13 a stale purge leaves no ledger entry
PASS AC-P07-13 purge: 204, Mongo and Blob ledger entries with IDs only
PASS AC-P07-13 resume, snapshots and blobs are gone
PASS AC-P07-13 the purge replays 204
PASS AC-P07-13 export holds the owner's active and trashed resumes and nothing else
PASS AC-P07-13 account deletion accepted; workers pending (checked after their tick)
PASS AC-P07-13 an interrupted purge is hidden from reads and lists at once
PASS AC-P07-15 the canary is in no problem body
PASS AC-P07-15 the canary filename is accepted and not kept
PASS AC-P07-16 doc-write: writes pass, then 429 with Retry-After (stopped after 120 PUTs plus the create)
PASS AC-P07-16 another user is unaffected
PASS AC-P07-16 photo-upload: the 21st attempt in the hour is 429 (20 here plus the foreign attempt in the isolation check)
PASS AC-P07-20 create and read return Unicode exactly
PASS AC-P07-20 the summary title is exact
PASS AC-P07-20 snapshot and copy keep it

114 of 114 checks passed

PASS AC-P07-13 account purge: the account is gone
PASS AC-P07-13 account purge: no resumes of the owner
PASS AC-P07-13 account purge: no resume_snapshots of the owner
PASS AC-P07-13 account purge: no idempotency_keys of the owner
PASS AC-P07-13 account purge: no blob under the owner prefix
PASS AC-P07-13 account purge: account entry in Mongo and Blob
PASS AC-P07-13 worker finished an interrupted photo removal: ledger, then blobs gone, marker pulled
PASS AC-P07-13 worker finished an interrupted purge: both ledger entries, blobs and resume gone
failed: 0
exit=0
```
