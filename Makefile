ROOT = $(shell pwd)/

EXTENSION_ROOT = $(ROOT)extension/
DIST           = $(ROOT)dist/
XPI            = $(DIST)$(NAME)-$(VERSION).xpi

NAME    = personas-plus
VERSION = $(shell sed -rn 's,.*<em:version>(.*)</em:version>,\1,p; /em:version/q' <$(EXTENSION_ROOT)install.rdf)

FILE_EXTENSIONS = jpg dtd js png properties xml xul

# Oh GNU make...
space :=
space +=

FILES = install.rdf \
	chrome.manifest \
	$(shell set -x; cd $(EXTENSION_ROOT); find content skin locale modules components defaults -regex '.*\.\($(subst $(space),\|,$(FILE_EXTENSIONS))\)$$')

xpi: $(XPI)

$(XPI): $(FILES:%=$(EXTENSION_ROOT)%) Makefile
	mkdir -p $(DIST)
	cd $(EXTENSION_ROOT)
	7z a $@ $(FILES)
	echo Created XPI file://$(XPI)

.ONESHELL:
