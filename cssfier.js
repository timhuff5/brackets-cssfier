define(function (require, exports, module) {

    var DocumentManager = brackets.getModule("document/DocumentManager"),
        PreferencesManager = brackets.getModule("preferences/PreferencesManager"),
        lines = 0,
        running = 0;

    function isFileExt(ext) {
        var doc = DocumentManager.getCurrentDocument(),
            language = doc.getLanguage(),
            fileType = language._id;
        if (ext == fileType) return true;
        return false;
    }

    function getSelector(el) {
        if (!el) return;
        var selector = "";
        if (el.id) {
            selector = "#" + el.id;
        } else if (el.className) {
            var classes = el.className.split(" ");
            selector = "." + classes[0];
        } else {
            selector = el.tagName.toLowerCase();
        }
        return selector;
    }

    function getSelectors(el) {
        if (!el) return;
        var selector = [];
        if (el.className && el.className.split) {
            var classes = el.className.split(" ");
            for (var i in classes) {
                selector.push("." + classes[classes.length - 1 - i]);
            }
        }
        if (el.id) {
            selector.push("#" + el.id);
        }
        if (selector.length === 0) {
            selector.push(el.tagName.toLowerCase());
        }
        return selector;
    }

    function recursive(array, params) {
        params = params || {};
        var can_go = 1;

        function recursive(array, parent, depth) {
            if (!can_go) return;
            if (array.length > 0) {
                for (var i = 0; i < array.length; i++) {
                    if (!can_go) return;
                    if (params.callback) {
                        can_go = params.callback(array[i], array, parent, depth, i);
                    }
                    if (!can_go) return;
                    if (array && array[i] && array[i].children.length > 0) {
                        recursive(array[i].children, array, depth + 1);
                    }
                }
            }
        }
        recursive(array, null, 0);
    }

    function printAdd(what, printed) {
        printed.text = printed.text + what;
    }

    function printTabs(depth) {
        var tabs = "";
        for (var i = 0; i < depth; i++) {
            tabs = tabs + "\t";
        }
        return tabs;
    }

    var previous = [];

    function printChildren(array, printed) {
        var _array,
            selectors = [],
            print = {};
        if (array.children.length > 0) {
            for (var i = 0; i < array.children.length; i++) {
                print.text = "";
                _array = array.children[i];
                printAdd(printTabs(_array.depth), print);
                printAdd(_array.selector + " {\n", print);
                lines++;
                if (_array.tag == "a") {
                    printAdd(printTabs(_array.depth + 1), print);
                    printAdd("&:hover{\n", print);
                    printAdd(printTabs(_array.depth + 1), print);
                    printAdd("}\n", print);
                    lines += 2;
                }
                if (_array.children.length > 0) {
                    printChildren(_array, print);
                }
                printAdd(printTabs(_array.depth), print);
                printAdd("}\n", print);
                selectors.push(print.text);
                printed.text = printed.text + print.text;
                lines++;
            }
        }
    }

    function printArray(array) {
        var printed = {};
        printed.text = "";
        if (array.length > 0) {
            for (var i = 0; i < array.length; i++) {
                printAdd(array[i].selector + " {\n", printed);
                printChildren(array[i], printed);
                printAdd("}", printed);
                if (i != array.length - 1) {
                    printAdd("\n", printed);
                }
                lines += 2;
            }
        }
        return printed;
    }

    function getLastDepth(array) {
        var d = 0;
        recursive(array, {
            callback: function (el, array, parent, depth) {
                if (depth > d) {
                    d = depth;
                }
                return true;
            }
        });
        return d;
    }

    function getSelectorsFromDepth(array, n) {
        var result = [],
            root;
        recursive(array, {
            callback: function (el, array, parent, depth) {
                if (depth === 0) {
                    root = el;
                }
                if (depth == n) {
                    result.push({
                        parent: parent,
                        element: el,
                        selector: el.selector,
                        root: root,
                        tag: el.tag
                    });
                }
                return true;
            }
        });
        return result;
    }

    function toParent(array, parent, element) {
        var result = [];
        recursive(array, {
            callback: function (el, arr, parent, depth, i) {
                var can_go = 1;
                if (el === element) {
                    can_go = 0;
                    var n = $.extend(true, {}, el);
                    n.depth = n.depth - 1;
                    parent.push(n);
                    arr.splice(i, 1);
                }
                return can_go;
            }
        });
        return array;
    }

    // checka se ficou algum espaço vazio entre depths e corrige;
    function emptyCheck(array) {
        var result = [];
        recursive(array, {
            callback: function (el, arr, parent, depth) {
                if (parent) {
                    var dif = el.depth - parent[0].depth;
                    if (dif > 1) {
                        el.depth = el.depth - dif + 1;
                    }
                }
                return true;
            }
        });
    }


    function addDepth(index, css, selector, tag, depth) {
        if (css[index]) {
            while (css[index]) {
                index++;
            }
        }
        css[index] = {};
        css[index].selector = selector;
        css[index].depth = depth;
        css[index].tag = tag;
        css[index].children = [];
        return index;
    }

    function refactor(cssi, css) {
        var max = getLastDepth(cssi),
            selectors,
            current,
            parent,
            has, i, j, n;
        for (i = max; i > 1; i--) {
            selectors = getSelectorsFromDepth(cssi, i);
            for (j in selectors) {
                current = selectors[j];
                parent = selectors[j].parent;
                has = 0;
                for (n in parent) {
                    if (n == j) continue;
                    if (current.selector == parent[n].selector /*|| current.tag == selectors[n].tag*/ ) {
                        has = 1;
                    }
                }
                if (!has) {
                    toParent(css, parent, current.element);
                }
            }
        }
    }

    function refactorAll(array) {
        var result = [];
        recursive(array, {
            callback: function (el, arr, parent, depth) {
                refactor([el], array);
                if (parent) {
                    var dif = el.depth - parent[0].depth;
                    if (dif > 1) {
                        el.depth = el.depth - dif + 1;
                    }
                }
                return true;
            }
        });
    }

    function populate(all, css, depth) {
        all = all.children();
        var i = 0,
            selectors = [],
            selector,
            index,
            ready;

        all.each(function () {
            var z, x;
            selector = getSelectors(this);
            index = [];
            for (z in css) {
                for (x in selector) {
                    if (css[z].selector == selector[x]) {
                        index.push(x);
                    }
                }
            }
            var to_add = [];
            for (x in selector) {
                if (
                    index.indexOf(x) == -1 &&
                    to_add.indexOf(selector[x]) == -1) {
                    to_add.push(selector[x]);
                }
            }
            for (x in to_add) {
                index = addDepth(i, css, to_add[x], this.tagName.toLowerCase(), depth);
            }
            if ($(this).children().length > 0 && to_add.length > 0) {
                populate($(this), css[index].children, depth + 1);
            }
        });
    }

    function run(codeMirror, change) {
        if (change.origin !== "paste" || change.origin != "paste" || (!isFileExt("scss") && !isFileExt("less")) || running) {
            return;
        }

        running = 1;
        lines = 0;
        var text = change.text,
            allText = "";

        for (var i = 0, l = text.length; i < l; i++) {
            allText = allText + text[i];
        }

        allText = allText.replace(/[\s]+/mig, " ")
            .replace(/^[\s]+/mig, "")
            .replace(/[\s]+$/mig, "")
            .replace(/(\>)([\s]+)(\<)/mig, "$1$3");

        if (!allText.match(/^(\<)(.*)(\>)$/)) {
            return;
        }

        var object = $("<div>" + allText + "</div>"),
            all = object,
            all_ = {},
            css = [];



        populate(object, css, 0);
        refactorAll(css);
        //        emptyCheck(css);

        var Printed = printArray(css),
            from = codeMirror.getCursor(true),
            to = codeMirror.getCursor(false),
            line = codeMirror.getLine(from.line);
        codeMirror.replaceRange(Printed.text, change.from, from);
        setTimeout(function () {
            running = 0;
        }, 100);
    }

    return {
        run: run
    };

});