ROOT_DIR = /Users/ben8/Research/ManyHands

BUILD_DIR = $(ROOT_DIR)/Build
SOURCE_DIR = $(ROOT_DIR)/Source/WebCryptoTypes

.PRECIOUS: $(BUILD_DIR)/%.js

clean:
	rm -r $(BUILD_DIR)/*

%.js: $(BUILD_DIR)/%.js
	@echo $@ "-->" $<

$(BUILD_DIR)/%.js: $(SOURCE_DIR)/%.ts
	tsc --out $@ $<

