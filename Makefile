ROOT = $(shell pwd)/

EXTENSION_ROOT = $(ROOT)extension/
DIST           = $(ROOT)dist/
XPI            = $(DIST)$(NAME)-$(VERSION).xpi

NAME    = personas-plus
VERSION = $(shell sed -rn 's,.*<em:version>(.*)</em:version>,\1,p; /em:version/q' <$(EXTENSION_ROOT)install.rdf)

# Oh GNU make...
space :=
space +=

FILE_EXTENSIONS  = jpg css dtd js png properties xml xul
ROOT_DIRECTORIES = content skin locale modules components defaults

FILES = install.rdf \
	chrome.manifest \
	$(shell set -x; cd $(EXTENSION_ROOT); \
	        find $(ROOT_DIRECTORIES) -regex '.*\.\($(subst $(space),\|,$(FILE_EXTENSIONS))\)$$')

xpi: $(XPI)
	@echo Created XPI file://$(XPI)

$(XPI): $(FILES:%=$(EXTENSION_ROOT)%) Makefile
	mkdir -p $(DIST)
	cd $(EXTENSION_ROOT)
	7z a $@ $(FILES)

.ONESHELL:
.PHONY: xpi
