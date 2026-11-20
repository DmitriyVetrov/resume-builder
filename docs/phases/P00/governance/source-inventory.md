# Source Inventory — P00 (GOV-01)

Baseline of every file under `docs/source/` at the P00 baseline date. Sizes and SHA-256 digests were computed with Python
`hashlib` from the file bytes, not typed. Any later change to `docs/source/**` needs an owner-approved re-baseline (PD-P00-06).

## Baseline

- Spec version: 0.1 draft · 2026-10-24
- Spec status: For review. Items marked **[DECISION]** need a product-owner choice before stage 2
- Spec SHA-256: cc411318efb4ccc2ebc3411b5df484bf0e724bd4a8f28dc9a1cecd560787ae45
- Baseline date: 2026-11-01
- File count: 90

## Files

| Path | Kind | Authority | Bytes | SHA-256 | Cited by | Personal data | Notes |
|---|---|---|---|---|---|---|---|
| docs/source/README.md | research | evidence | 60030 | 1668cab737cf9af7deab9ffda94fd4b1130b9c07357d6dd9abcc98918412ef5b | TECHNICAL-SPEC.md header; TECHNICAL-SPEC.md §1.3; TECHNICAL-SPEC.md §3.2; TECHNICAL-SPEC.md §5.4; TECHNICAL-SPEC.md §5.7; TECHNICAL-SPEC.md §5.8; TECHNICAL-SPEC.md §5.9; TECHNICAL-SPEC.md §5.10; TECHNICAL-SPEC.md §5.15; TECHNICAL-SPEC.md §13 | no | Reference-product research in Russian. Persona and test contact values are fictitious (README header); the 75-screenshot claim is checked in Notes |
| docs/source/TECHNICAL-SPEC.md | spec | normative | 53101 | cc411318efb4ccc2ebc3411b5df484bf0e724bd4a8f28dc9a1cecd560787ae45 | — | yes | Only normative source (PROJECT-CHARTER.md hierarchy). §9.4 and §10.3 hold the owner's real contact data; never copy it |
| docs/source/export/A-default-SLO7-naval.pdf | export-sample | evidence | 75926 | 152b486a5093fc45113b47d90877fe338e54b597f12e682cfaed2c84af4a60a6 | README.md §9.2 | no | RG export of the fictitious test document; checked: persona name and example.com contacts only |
| docs/source/export/A-default.txt | export-sample | evidence | 2922 | e50fb6605be3e7b554e009fc2a1b72afc948317e139fc2f93754ccc1b5f9ae47 | TECHNICAL-SPEC.md §9.4; README.md §10 | no | RG export of the fictitious test document; checked: persona name and example.com contacts only |
| docs/source/export/B-compact-small-000.pdf | export-sample | evidence | 76074 | ba536a9a3eb62fd18772e0e33208663e9deee05bd4fd0c8349b2688ba8979eda | — | no | RG export of the fictitious test document; checked: persona name and example.com contacts only |
| docs/source/export/C-spacious-large-20-20-20.pdf | export-sample | evidence | 78176 | 65e9b727073c2b7bffa6a712ac870eb569da510e6e857aa463cda7043e8d1e40 | — | no | RG export of the fictitious test document; checked: persona name and example.com contacts only |
| docs/source/img/01-home.png | screenshot | evidence | 373999 | c743d6984953c0596fde72e19dc5e05ed7e0f36ca03a8299ae1e92f1406c1afa | README.md §2.1 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/02-templates-gallery.png | screenshot | evidence | 388670 | 476e266ea8db83d8bf9935487ba0eb29b32af28e4fd9d9ea83ddd62315cbccc3 | README.md §2.1 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/03-dashboard-resumes.png | screenshot | evidence | 258158 | 09f2c2a6091b80381bd557a6d784489a9b76a48e9c193a8187bd2583f3a41be0 | TECHNICAL-SPEC.md §5.2; README.md §2.2 | yes | Inspected: shows thumbnails of the owner's own resumes in the logged-in account |
| docs/source/img/04-how-to-start.png | screenshot | evidence | 310916 | 528ffdd45cf122fb6f53538c85d7b11e3d53caf891879530a063c4e310e1923b | — | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/05-create-new-modal.png | screenshot | evidence | 293689 | 0c753afc967f374332797bd370e8f67a310393fb8d33cf50eb286bf57c35f077 | TECHNICAL-SPEC.md §5.2; README.md §2.2 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/06-questionnaire-1.png | screenshot | evidence | 362806 | 810efe02e24bc0b9d4de3e38ffacfb1f39c503d0cac389ea97cb2c8c2232ab6f | TECHNICAL-SPEC.md §3.2; TECHNICAL-SPEC.md App. A | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/07-questionnaire-2.png | screenshot | evidence | 473404 | 585a04a7287e019059a91577e028981c2869e5528fcdddcc9b85951572d46777 | TECHNICAL-SPEC.md §3.2; TECHNICAL-SPEC.md App. A | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/08-questionnaire-3.png | screenshot | evidence | 472139 | aa2c2bcff0bde0821da288de94149b898a7030b4a8c2c1fc3a106ffb24053057 | TECHNICAL-SPEC.md §3.2; TECHNICAL-SPEC.md App. A | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/10-choose-template.png | screenshot | evidence | 180446 | 93f786c01b10b319711dea1a3ac9e06c2cf3b85e4978caac2f9d9e33d0c86a59 | TECHNICAL-SPEC.md §3.2; TECHNICAL-SPEC.md App. A; README.md §7.1 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/11-choose-template-filter-1col.png | screenshot | evidence | 160619 | 27f5dfd30fe3d0889584aec2564257e6db5a4961732731c985743db0c715b374 | TECHNICAL-SPEC.md §3.2; TECHNICAL-SPEC.md App. A; README.md §7.1 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/12-choose-template-color-hover.png | screenshot | evidence | 10325 | b2fd88c308cf11a8721affce167adeee713667ba10deedbe7820c056c2c9c79c | TECHNICAL-SPEC.md App. A | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/12-choose-template-color-naval.png | screenshot | evidence | 177775 | 9bc07a3702c50617eb5cc43e7c3f1a2fc6e325936385eff2cf483498b0476fe7 | — | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/13-choose-template-hover-card.png | screenshot | evidence | 215160 | e7e183e63213af648e9a8594b2e33bf30ec9cafd9ba344b2f9db740bc350a621 | — | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/14-after-select-template.png | screenshot | evidence | 137528 | a40eab3295b12d712f754de298769ce6f536705d4851108f172a672dca540127 | TECHNICAL-SPEC.md §3.2; TECHNICAL-SPEC.md App. A | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/15-contact-step.png | screenshot | evidence | 138230 | 34fc32fa1d66ab9021c495c7acbf347eaf2ed97171a65fc0fc99edfd6cf5a032 | TECHNICAL-SPEC.md §5.3; TECHNICAL-SPEC.md App. A; README.md §4.1 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/16-contact-more-details.png | screenshot | evidence | 136250 | 4585b284f78ac3cdfb8217fd2d6429628659be4091bae29030929fd462f35d28 | TECHNICAL-SPEC.md App. A; README.md §4.1 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/17-contact-all-extra-fields.png | screenshot | evidence | 132763 | 5299e60193c600943a1a3037f47d94056b068781ad418f2fdb24bb04d1f342f7 | TECHNICAL-SPEC.md App. A; README.md §4.1 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/18-contact-jobtitle-autosuggest.png | screenshot | evidence | 140795 | fa3d0578194aefe404047f57ae5ff28b05419e1d6b8293a41c282000b408b936 | TECHNICAL-SPEC.md §3.2; TECHNICAL-SPEC.md App. A; README.md §4.1 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/19-contact-filled.png | screenshot | evidence | 146613 | 98db3bb92b6249ec23d0b543c30bfdc0a2bae1a74144ac1e399d921fd5028ff0 | TECHNICAL-SPEC.md App. A; README.md §4.1 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/20-contact-dob-picker.png | screenshot | evidence | 145557 | 1f47879eee866524d17c824883d9f7a1022f215e0cd9f8440cfed08716476de9 | TECHNICAL-SPEC.md App. A; README.md §4.1 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/21-contact-preview-modal.png | screenshot | evidence | 147302 | 3570346fc8e99d2e78f92db93d199d3446ed2ae5e7076fec7d90d6a2cfc3f202 | README.md §4; README.md §8 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/22-preview-formatting-tab.png | screenshot | evidence | 99013 | 15a20ad675f5b02f51d2225f4e9d64f5a3454e684c7343d758feea2460053bef | README.md §4 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/23-experience-step.png | screenshot | evidence | 117119 | 64e18eae3dc114b49d7e3957c0cc2b686a1c08f7131160e2105ee0520bcf8211 | — | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/24-experience-form.png | screenshot | evidence | 129704 | abdaa553301a795937247117dae9111bacd7b7837db1df4542a3aa87b9260818 | TECHNICAL-SPEC.md App. A; README.md §4.2 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/25-experience-filled-current.png | screenshot | evidence | 132151 | b6bd3ff3f10303cbe159b28c4fe0878cd17ba1319eefcee9b456622872faa9a4 | TECHNICAL-SPEC.md §5.6; TECHNICAL-SPEC.md App. A; README.md §4.2 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/26-experience-bullets-step.png | screenshot | evidence | 216666 | c5832e98ea17903651b589407cc2f01ad14b3095581f499da59deca8b2f15f4b | TECHNICAL-SPEC.md §3.2; TECHNICAL-SPEC.md App. A; README.md §4.2 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/27-responsibilities-editor.png | screenshot | evidence | 120010 | 98dd2ba8ba2bead8526911e9d40b177eddee7d227193277d223263c1b50985d8 | TECHNICAL-SPEC.md §3.2; TECHNICAL-SPEC.md §5.7; TECHNICAL-SPEC.md App. A; README.md §4.2 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/28-responsibilities-typed.png | screenshot | evidence | 172397 | c98aaf7f4509e2b0cd7c60f3c87a63672362cf3d99598d36c3775c47a19ab078 | TECHNICAL-SPEC.md §5.7; TECHNICAL-SPEC.md App. A; README.md §4.2 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/29-responsibilities-prewritten-added.png | screenshot | evidence | 178010 | 889df33928dd9418cea02336d1ae5c27691ebae49214c8111931bb2ad877d045 | TECHNICAL-SPEC.md §3.2; TECHNICAL-SPEC.md App. A; README.md §4.2 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/30-responsibilities-add-url.png | screenshot | evidence | 124646 | a592ab7f3d472b4c3b1086d94dc14f71da22b868f618f3c154cad51d100b6dfa | TECHNICAL-SPEC.md §5.7; TECHNICAL-SPEC.md App. A; README.md §4.2 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/31-responsibilities-search-other-title.png | screenshot | evidence | 174144 | afa95fd769920c6ddc77df5251dd0b2687a5b897c0109d701d16d358334c42e5 | TECHNICAL-SPEC.md §3.2; TECHNICAL-SPEC.md App. A; README.md §4.2 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/32-experience-summary-list.png | screenshot | evidence | 100181 | b6a07475248bdae8e24d19acc425ee3c2f4cc48d09f519cc4a8585f7d65e7777 | — | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/33-experience-list-3-jobs.png | screenshot | evidence | 151340 | dbe326e1a53f77370cbdf772642f92b403c84d116db0c07daf5e652fd4fe09c5 | TECHNICAL-SPEC.md App. A; README.md §4.2 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/34-experience-dragging.png | screenshot | evidence | 140666 | dfcd9fa52b688aa87d4be6da4e541f6e6d2dea0aba2cc4732004f85d328c7716 | README.md §4.2 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/35-experience-after-drag.png | screenshot | evidence | 150709 | 1d4c901eb5760a2ec750d3c983292cb6c97566aa9807623b780c8aab927724f8 | TECHNICAL-SPEC.md §5.5; TECHNICAL-SPEC.md App. A; README.md §4.2 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/36-education-step.png | screenshot | evidence | 103078 | 1e03d417dcada160accc1f17f50833f742523663f72253657107ed2bba85d865 | — | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/37-education-form.png | screenshot | evidence | 101417 | da6e5dd1b3eff106f87d191838e5e851526482c1c6b46bd8744fbf3c97ba8028 | TECHNICAL-SPEC.md App. A; README.md §4.3 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/38-education-details-open.png | screenshot | evidence | 132288 | 832ad915c82ece1f148dbebd5a230369aa2eaa0d9d28398e62c70707a0cb8472 | TECHNICAL-SPEC.md §3.2; TECHNICAL-SPEC.md App. A; README.md §4.3 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/39-education-filled.png | screenshot | evidence | 145469 | af38622c4537499ffcc3650fbd283f89ff36ab574bbfbd31e47328f1739ae28f | TECHNICAL-SPEC.md App. A; README.md §4.3 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/40-education-review.png | screenshot | evidence | 92092 | 11d7580e5e1d8320bcc36d59b4c80062f88443031f1d19e4cb2ebbe3633834ea | README.md §4.3 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/41-certifications-step.png | screenshot | evidence | 146717 | 265014053a6f2bb97eaa123b3e97a1883a7f6af45a3d800cb94169516cc69142 | TECHNICAL-SPEC.md App. A; README.md §4.4 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/42-skills-tips.png | screenshot | evidence | 121009 | 683c2f206351003e4a538995db232f5dfd5b09650027ee9f1424bb22c9bfd201 | — | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/43-skills-step.png | screenshot | evidence | 200019 | ef6cd1b0db9d8ac0cc02da2400ab0ea9cfdd786ca06ed97108727dbdfa0c93e7 | TECHNICAL-SPEC.md §3.2; TECHNICAL-SPEC.md App. A; README.md §4.5 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/44-skills-ai-added.png | screenshot | evidence | 121498 | 6ded5b28668ebf0f6564e6f81c30efc947901cc2c63db05c7f535a4a1ef55728 | TECHNICAL-SPEC.md §3.2; TECHNICAL-SPEC.md App. A; README.md §4.5 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/45-skills-custom.png | screenshot | evidence | 126454 | 0acc262b5da78cc593639cb0223abc6d507d1358a10071c3e38e0c8bde29fef4 | TECHNICAL-SPEC.md §3.2; README.md §4.5 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/46-summary-tips.png | screenshot | evidence | 126347 | a00575fde58ceadf260684c120df77b26aec28dae9fcb63c0a8014ecb5bdc8a8 | — | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/47-summary-step.png | screenshot | evidence | 142531 | 9d024b4d7cd7b31b6cd44773713ca032a5864557c9b417b1d59c31f71cfaf787 | TECHNICAL-SPEC.md §3.2; TECHNICAL-SPEC.md App. A; README.md §4.6 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/48-summary-filled.png | screenshot | evidence | 148042 | 55ffd7ec5014ef9d8c05e6b383f45b4bac1cfa789961af21e7fd501106278eda | README.md §4.6 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/49-after-summary.png | screenshot | evidence | 69194 | ca216e9754b5f82147410425c6da1eed0be71a77b4dc96e1a93fa0ede70630a6 | — | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/50-references-question.png | screenshot | evidence | 69194 | ca216e9754b5f82147410425c6da1eed0be71a77b4dc96e1a93fa0ede70630a6 | README.md §4.7 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/51-references-form.png | screenshot | evidence | 63147 | 77af6b96506686eeb5e17804aae3ba89ace29d1dc2850a1e08f38211a7e36f5d | README.md §4.7 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/52-references-add.png | screenshot | evidence | 71589 | 323350db1f0352c1f70bfeb123d30748dbb3eaafe53514f05a15aeb0484f3c25 | README.md §4.7 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/53-references-list.png | screenshot | evidence | 70069 | 449e90341adcdc9924450c53c9a252e41b5fa7f393fdbd1595f0089cbc1b5093 | README.md §4.7 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/54-after-references.png | screenshot | evidence | 116935 | 77dd78312f15a5c908cbd1317efe1c6a450a64baaa5350d62462154f0ecd896a | README.md §4.8 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/55-addsec-language-added.png | screenshot | evidence | 126663 | be15fcf46824ca73bf0759398bf5c9ba8d1eb4b96147b31c63c74b552df761e7 | README.md §4.8 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/56-addsec-language-levels.png | screenshot | evidence | 127203 | 80e3c3ac2fce9ad6528f664ef761a8beb4d9873f4c910009b69486e5f0f6c944 | README.md §4.8 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/57-addsec-languages-filled.png | screenshot | evidence | 129239 | eca12ddad11fc9fa60e1c6f9bd16e66c4fe6dff28ead7a71632f9e67f05ae7f5 | TECHNICAL-SPEC.md App. A; README.md §4.8 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/58-addsec-all-open.png | screenshot | evidence | 101942 | 5ca49ef754c05b9b38cdb4067c64e2d6d92fbb168fde0150f40cb45c90c18058 | TECHNICAL-SPEC.md App. A; README.md §4.8 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/59-addsec-websites.png | screenshot | evidence | 131787 | 61a5d8d7d372ca4b36649ec631f5645cefc7666631fa1ffbefe980ec35036776 | TECHNICAL-SPEC.md App. A; README.md §4.8 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/60-addsec-custom.png | screenshot | evidence | 123802 | 9f9e1ecc9c74400b2ffab7835a6b26fc9d11d0808aad76badc3f9f071872c79b | TECHNICAL-SPEC.md §5.3; TECHNICAL-SPEC.md §5.5; TECHNICAL-SPEC.md App. A; README.md §4.8 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/64-rearrange-sections.png | screenshot | evidence | 96553 | f44ef91132fab977163cce68df2b1410ffd54062ba41cf134c81434f0024ac44 | TECHNICAL-SPEC.md §5.3; TECHNICAL-SPEC.md App. A; README.md §5 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/66-preview-after-move-educ.png | screenshot | evidence | 140786 | 3831b8b89b86fdcada7940f8f330443ea9f9e24642e869e8259f69926e3db4c6 | TECHNICAL-SPEC.md §5.4; TECHNICAL-SPEC.md §7; TECHNICAL-SPEC.md App. A; README.md §8; README.md §14.1 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/67-rename-section.png | screenshot | evidence | 235274 | 3e5a73698e82acc83f3e47ff6d7623552728ed7f69efb06f0ef76921c99bfb34 | TECHNICAL-SPEC.md §5.3; TECHNICAL-SPEC.md §5.5; TECHNICAL-SPEC.md App. A; README.md §5 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/68-delete-section-confirm.png | screenshot | evidence | 121674 | ceced087f3c82721436e04e6f0691e0838f29df04d2d0d411962750038217173 | TECHNICAL-SPEC.md App. A; README.md §6.4 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/70-finalize-formatting-tab.png | screenshot | evidence | 196124 | 17cc9f7b479753a3edcbe929bad799e676dd1c375a97c279689f8042f6fddab4 | TECHNICAL-SPEC.md §3.2; TECHNICAL-SPEC.md §5.3; TECHNICAL-SPEC.md §5.8; TECHNICAL-SPEC.md §5.9; TECHNICAL-SPEC.md App. A; README.md §5; README.md §7.2 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/71-more-font-settings.png | screenshot | evidence | 201873 | 4c14c1422684fe18881c500360a9e74e3fad267ddf4a2b5987254df609dd6eb6 | TECHNICAL-SPEC.md §5.3; TECHNICAL-SPEC.md §5.10; TECHNICAL-SPEC.md App. A; README.md §7.5 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/73-font-list.png | screenshot | evidence | 199639 | 79e35db737b5a298171060e5a4ed9ed911199c91dbe32232187b9fb37e38f43d | TECHNICAL-SPEC.md §5.10; TECHNICAL-SPEC.md App. A; README.md §7.3 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/76-template-mlo1-corporate.png | screenshot | evidence | 264847 | 8ed6ceb6b2888c541461922bf9abf4a08bb05360dc3eafdfd3e7089fdce8d452 | TECHNICAL-SPEC.md §5.8; TECHNICAL-SPEC.md §7; TECHNICAL-SPEC.md App. A; README.md §7.1; README.md §7.2 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/77-download-score-modal.png | screenshot | evidence | 92496 | dde3e6c326f2bbac0d943c7c8dc8b2a9a835f2a637a6d9e8ab5c17eeb2af84e9 | TECHNICAL-SPEC.md §3.2; TECHNICAL-SPEC.md §5.12; TECHNICAL-SPEC.md App. A; README.md §9.1 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/78-download-step1-format.png | screenshot | evidence | 58705 | 7f85cfa20f700400bd3620ecaeca2d221e49509660f0302dc74767bd13b28b3b | TECHNICAL-SPEC.md §3.2; TECHNICAL-SPEC.md §5.12; TECHNICAL-SPEC.md App. A; README.md §9.1 | no | Inspected: shows only the fictitious test document name |
| docs/source/img/79-preview-compact.png | screenshot | evidence | 120947 | 23adaff2d3477db5eb8c16d97b741a3241cfd0a640cd2b2a6d1b90a0ed372929 | TECHNICAL-SPEC.md App. A | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/80-pdf-B-compact-pages.png | screenshot | evidence | 70268 | bc849216b618927e6fa7c64daf7467375b232e0b5356e2441d1f11e9602227c1 | TECHNICAL-SPEC.md App. A; README.md §9.3 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/81-pdf-C-spacious-pages.png | screenshot | evidence | 95782 | 13cec47bbfed118b55e6f5abf45eed50cdd30ab39f1e347aca57172356e0a5e6 | TECHNICAL-SPEC.md §8; TECHNICAL-SPEC.md App. A; README.md §9.3 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/83-view-more-sections.png | screenshot | evidence | 133419 | 828408f58781b234aa61ececd77deb54a7cb93f0bb42a533fc4a50e52e05d4b2 | README.md §4.8 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/84-pdf-A-default-pages.png | screenshot | evidence | 147243 | dacef4010bebf1a6c93db67931aeee30364a853bdf9ac6c2f471003b147da6ed | TECHNICAL-SPEC.md §5.7; TECHNICAL-SPEC.md §7; TECHNICAL-SPEC.md App. A; README.md §8; README.md §9.3 | yes | Not inspected; conservative value because the research ran in the owner's logged-in account (see img/03) |
| docs/source/img/90-template-T1-reference-1.png | screenshot | normative-reference | 203288 | 5aff0303d19592e2dc0d48ca478e64bda28a78f684000cd2eb5cafca784d579a | TECHNICAL-SPEC.md header; TECHNICAL-SPEC.md §6; TECHNICAL-SPEC.md §6.6; TECHNICAL-SPEC.md App. A | yes | Render of the owner's CV; named as target T1 in §6 and App. A |
| docs/source/img/90-template-T1-reference-2.png | screenshot | normative-reference | 199650 | 4d52f230ef8c5c191a5a323e254de995d0104fdc078ce954e1539b56146ec959 | TECHNICAL-SPEC.md header; TECHNICAL-SPEC.md App. A | yes | Render of the owner's CV; named as target T1 in §6 and App. A |
| docs/source/img/90-template-T1-reference-3.png | screenshot | normative-reference | 231088 | a9f49d3298228a4e0f50e4a74816d2c7f7d4dda812a4eb29b8908ad6f6c8ae17 | TECHNICAL-SPEC.md header; TECHNICAL-SPEC.md App. A | yes | Render of the owner's CV; named as target T1 in §6 and App. A |
| docs/source/img/90-template-T1-reference-4.png | screenshot | normative-reference | 79152 | 55b92f2f188cf79daf1e5d12cd121b05a981e08edea469eaeb5c1606f8e9511c | TECHNICAL-SPEC.md header; TECHNICAL-SPEC.md §6.8; TECHNICAL-SPEC.md App. A | yes | Render of the owner's CV; named as target T1 in §6 and App. A |
| docs/source/img/91-template-T1-header-detail.png | screenshot | normative-reference | 44190 | 5461551a1fb58162fea11ef7e06ec72d5bb4f219e3cbe6fc74b7d5d22f1e4eb4 | TECHNICAL-SPEC.md §5.4; TECHNICAL-SPEC.md §6; TECHNICAL-SPEC.md §6.3; TECHNICAL-SPEC.md App. A | yes | Render of the owner's CV; named as target T1 in §6 and App. A |
| docs/source/img/92-template-T1-timeline-detail.png | screenshot | normative-reference | 83306 | 8c95b9771a1efc2f34667b45a146e5b9c9dadb82e593ee053e92d680dbf99c4f | TECHNICAL-SPEC.md §6; TECHNICAL-SPEC.md §6.7; TECHNICAL-SPEC.md App. A | yes | Render of the owner's CV; named as target T1 in §6 and App. A |
| docs/source/img/93-template-T1-education-skills-detail.png | screenshot | normative-reference | 52977 | 1cbf086430ab7aefee9f1603c88d39de1f9d8dcbfd2cbd4bd89c4ffcc9ee00ed | TECHNICAL-SPEC.md §6; TECHNICAL-SPEC.md §6.6; TECHNICAL-SPEC.md §6.7; TECHNICAL-SPEC.md App. A | yes | Render of the owner's CV; named as target T1 in §6 and App. A |
| docs/source/reference/README.md | index | index | 594 | 9024a9464bc78af242519e1fa7a8e0a68f1a9f768cfde50ac96294a7ed82992b | — | no | Owner index of relocated inputs (SC-16) |
| docs/source/reference/SWE-Dmytro-Vietrov.pdf | reference-cv | normative-reference | 73676 | 0ee8ece8b00071c96e43b26bd85d02d8429f72a70c92c28e038aeb7316deceb7 | TECHNICAL-SPEC.md header; reference/README.md header | yes | Owner's CV, target design of T1 (§6); cited by the spec at its old path (SC-16). Holds real contact data |

## Requirement ID census

| Group | Count | M | S | C | W |
|---|---|---|---|---|---|
| FR-ACC | 6 | 3 | 1 | 2 | 0 |
| FR-LIB | 6 | 5 | 1 | 0 | 0 |
| FR-EDT | 8 | 6 | 2 | 0 | 0 |
| FR-HDR | 6 | 5 | 1 | 0 | 0 |
| FR-SEC | 11 | 9 | 2 | 0 | 0 |
| FR-TYP | 3 | 3 | 0 | 0 | 0 |
| FR-RTE | 8 | 6 | 1 | 0 | 1 |
| FR-TPL | 5 | 5 | 0 | 0 | 0 |
| FR-CLR | 4 | 3 | 0 | 0 | 1 |
| FR-LAY | 10 | 7 | 3 | 0 | 0 |
| FR-PRV | 8 | 6 | 2 | 0 | 0 |
| FR-PDF | 10 | 9 | 1 | 0 | 0 |
| FR-TXT | 7 | 5 | 2 | 0 | 0 |
| FR-PER | 5 | 4 | 1 | 0 | 0 |
| FR-PHO | 5 | 4 | 1 | 0 | 0 |
| NFR | 14 | 12 | 2 | 0 | 0 |
| Total | 116 | 92 | 20 | 2 | 2 |

## Notes

1. **File composition.** 90 files: the specification, the research `README.md`, 82 screenshots in `img/`, 4 export
   samples in `export/` (3 PDF, 1 TXT) and 2 files in `reference/` (the owner's index and the reference CV).
2. **Screenshot count.** The research header claims "75 screenshots", but 82 PNG files are on disk. The difference is the
   7 T1 renders of the owner's CV (`img/90-*` four pages, `img/91`, `img/92`, `img/93`), which the specification cites as the
   target design (§6, App. A) and the research does not mention: 82 = 75 + 7.
3. **Authority.** `TECHNICAL-SPEC.md` is the only `normative` row. The reference CV and its renders `img/90…93` are
   `normative-reference` because §6 and App. A name them as the T1 target. Every other screenshot and export sample is `evidence`
   (App. A: "reference material, not as the target design, unless a requirement says so"), including `img/66` and `img/76`,
   which App. A lists only as the basis of the open T2/T3 proposal (D-12).
4. **Personal data.** 83 rows are `yes`. Confirmed by reading: the specification (§9.4 and §10.3 hold the owner's real
   contact data), the reference CV and `img/03` (the owner's own resumes in the research account). The renders `img/90…93`
   show the owner's CV. Every other screenshot was **not inspected** and is marked `yes` as the conservative value: the
   research ran in the owner's logged-in account, and the wizard pre-fills the account name (README §4.1). Only `img/78` was
   inspected and shows no personal data. The export samples were checked with `pdftotext` and `grep`: they contain only the
   fictitious persona and `example.com` contacts. The research README contains one fictitious e-mail and one test phone number
   (README §10, §12) that match the AC-P00-23 patterns. No GOV file copies any of these values.
5. **Cited by** is computed with the reference extractors of the P00 checks (test-plan §5.7) over TECHNICAL-SPEC.md and
   README.md. Prose ranges written as two separate references (for example the §5.3 range from `img/15` to `img/60`) count
   only at their endpoints. Directory references (`img/`, `export/`) are not attributed to single files. 11 files have no
   citation (`—`).
6. **Relocated and missing references (SC-16).** The spec header Inputs cite the reference CV at its original workspace path,
   and §5.15 cites a photo-flow note file that was not copied. `reference/README.md` records the CV as copied to
   `docs/source/reference/` and the note file as "not copied" (personal job-hunt notes). The photo flow therefore rests on
   README §4.1 alone, and README App. B states that photo upload was described from earlier work and not re-tested.
7. **Census.** Counts are recomputed from requirement rows of the form `| FR-<AAA>-<nn> | <Pri> |` and `| NFR-<nn> | <Pri> |`.
   The C rows are FR-ACC-05 and FR-ACC-06; the W rows are FR-RTE-07 and FR-CLR-04 (GOV-03). Pagination rules PG-01…PG-09 have
   no priority column and are not counted (SC-19).
