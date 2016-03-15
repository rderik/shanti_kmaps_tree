// the semi-colon before function invocation is a safety net against concatenated
// scripts and/or other plugins which may not be closed properly.
;(function ($, window, document, undefined) {

    "use strict";

    // undefined is used here as the undefined global variable in ECMAScript 3 is
    // mutable (ie. it can be changed by someone else). undefined isn't really being
    // passed in so we can ensure the value of it is truly undefined. In ES5, undefined
    // can no longer be modified.

    // window and document are passed through as local variable rather than global
    // as this (slightly) quickens the resolution process and can be more efficiently
    // minified (especially when both are regularly referenced in your plugin).

    var SOLR_ROW_LIMIT = 2000;
    var DEBUG = false;

    // Create the defaults once
    var pluginName = "kmapsTree",
        defaults = {
            termindex_root: "http://kidx.shanti.virginia.edu/solr/termindex-dev-update",
            kmindex_root: "http://kidx.shanti.virginia.edu/solr/kmindex-dev",
            type: "places",
            root_kmapid: 13735,
            root_kmap_path: "/", // "/13735/13740/13734",
            baseUrl: "http://subjects.kmaps.virginia.edu/"
        };

    // copied from jquery.fancytree.js to support moved loadKeyPath function
    function _makeResolveFunc(deferred, context){
        return function(){
            deferred.resolveWith(context);
        };
    }

    // The actual plugin constructor
    function KmapsTreePlugin(element, options) {
        this.element = element;
        // jQuery has an extend method which merges the contents of two or
        // more objects, storing the result in the first object. The first object
        // is generally empty as we don't want to alter the default options for
        // future instances of the plugin
        this.settings = $.extend({}, defaults, options);
        this._defaults = defaults;
        this._name = pluginName;
        this.init();
    }

    function log(msg) {
        if (DEBUG) {
            console.log(msg);
            $('#debug').append(msg + "<br/>");
        }
    }

    $.extend(KmapsTreePlugin.prototype, {
        init: function () {
            // Place initialization logic here
            // You already have access to the DOM element and
            // the options via the instance, e.g. this.element
            // and this.settings
            // you can add more functions like the one below and
            // call them like so: this.yourOtherFunction(this.element, this.settings).
            var plugin = this;
            this.element = $(plugin.element);
            // $(plugin.element).append($("<div>").text(plugin.settings.termindex_root), $("<div>").text(plugin.settings.kmindex_root));

            $(this).uniqueId();  // create unique ID if it doesn't have one already

            log("THIS ID:" + this.id);

            //
            // Fancytree plugin
            //
            $(plugin.element).fancytree({
                extensions: ["filter", "glyph"],
                generateIds: false,
                quicksearch: false,
                checkbox: false,
                selectMode: 2,
                minExpandLevel: 1, // TODO: reconcile this with lazy loading.
                theme: 'bootstrap',
                debugLevel: 0,
                // autoScroll: true,
                autoScroll: false,
                filter: {
                    highlight: true,
                    counter: false,
                    mode: "hide",
                    leavesOnly: false
                },
                cookieId: this.id,
                idPrefix: this.id,
                source: {
                    url: plugin.buildQuery(plugin.settings.termindex_root, plugin.settings.type, plugin.settings.root_kmap_path, 1, plugin.settings.root_kmap_path.split('/').length)
                },

                // User Event Handlers
                select: function (event, data) {
                    plugin.sendEvent("SELECT", event, data);
                },
                focus: function (event, data) {
                    data.node.scrollIntoView(true);
                    plugin.sendEvent("FOCUS", event, data);
                },
                keydown: function (event, data) {
                    plugin.sendEvent("KEYDOWN", event, data);
                },
                activate: function (event, data) {
                    plugin.sendEvent("ACTIVATE", event, data);
                },

                //
                // Fancytree building Event Handlers
                //
                createNode: function (event, data) {

                    data.node.span.childNodes[2].innerHTML = '<span id="ajax-id-' + data.node.key + '">' + data.node.title + ' ..... ' + data.node.data.path + '</span>';
                    var path = $.makeArray(data.node.getParentList(false, true).map(function (x) {
                        return x.title;
                    })).join("/");

                    var theElem = data.node.span;
                    var theKey = data.node.key;
                    var theType = plugin.settings.type;
                    var theTitle = data.node.title;
                    var theCaption = data.node.data.caption;
                    var theIdPath = data.node.data.path;
                    // decorateElementWithPopover(theElem, theKey,theTitle, theIdPath,theCaption );
                    decorateElemWithDrupalAjax(theElem, theKey, theType);
                    return data;
                },
                renderNode: function (event, data) {
                    if (!data.node.isStatusNode()) {
                        data.node.span.childNodes[2].innerHTML = '<span id="ajax-id-' + data.node.key + '">' + data.node.title + ' [' + data.node.key + ']</span>';
                        var path = $.makeArray(data.node.getParentList(false, true).map(function (x) {
                            return x.title;
                        })).join("/");

                        // decorateElementWithPopover(data.node.span, data.node.key,data.node.title, data.node.path, data.node.data.caption);
                        $(data.node.span).find('#ajax-id-' + data.node.key).once('nav', function () {
                            var base = $(this).attr('id');
                            var argument = $(this).attr('argument');
                            var url = location.origin + location.pathname.substring(0, location.pathname.indexOf(plugin.settings.type)) + plugin.settings.type + '/' + data.node.key + '/overview/nojs';
                            Drupal.ajax[base] = new Drupal.ajax(base, this, {
                                url: url,
                                event: 'navigate',
                                progress: {
                                    type: 'throbber'
                                }
                            });
                        });
                    }

                    return data;
                },

                postProcess: function (event, data) {
                    log("postProcess!");
                    data.result = [];

                    var docs = data.response.response.docs;
                    var facet_counts = data.response.facet_counts.facet_fields.ancestor_id_path;
                    var rootbin = {};
                    var countbin = {};

                    docs.sort(function (a, b) {
                        var aName = a.ancestor_id_path.toLowerCase();
                        var bName = b.ancestor_id_path.toLowerCase();
                        return ((aName < bName) ? -1 : ((aName > bName) ? 1 : 0));
                    });

                    for (var i = 0; i < facet_counts.length; i += 2) {
                        var path = facet_counts[i];
                        var count = facet_counts[i + 1];
                        countbin[path] = (count - 1);
                    }

                    for (var i = 0; i < docs.length; i++) {
                        var doc = docs[i];
                        var ancestorIdPath = docs[i].ancestor_id_path;
                        var pp = ancestorIdPath.split('/');
                        var localId = ancestorIdPath;

                        if (pp && pp.length != 0) {
                            localId = pp.pop();
                        } else {
                            pp = [];
                        }

                        var parentPath = pp.join("/");
                        var n =
                        {
                            key: localId,
                            title: doc.header,
                            parent: parentPath,
                            path: ancestorIdPath,
                            level: doc.level_i,
                            lazy: (countbin[ancestorIdPath]) ? true : false
                        };
                        rootbin[ancestorIdPath] = n;  // save for later
                    }


                    //if (DEBUG) console.log("ROOT BIN");
                    //if (DEBUG) console.log(JSON.stringify(rootbin));
                    var props = Object.getOwnPropertyNames(rootbin);
                    for (var i = 0; i < props.length; i++) {
                        var node = rootbin[props[i]];
                        //if (DEBUG) console.log("node: " + node.path + "  parent:" + node.parent);

                        if (rootbin[node.parent]) {
                            var p = rootbin[node.parent];
                            if (!p.children) {
                                p.children = []
                            }
                            p.children.push(node);
                            p.lazy = false;
                            delete rootbin[props[i]];
                        }
                    }
                    var x = Object.getOwnPropertyNames(rootbin);
                    for (var i = 0; i < x.length; i++) {
                        data.result.push(rootbin[x[i]]);
                    }
                    if (DEBUG) console.dir({log: "result", "data": data.result});
                },

                lazyLoad: function (event, data) {
                    var id = data.node.key;
                    var lvla = 1 + data.node.data.level;
                    var lvlb = 1 + data.node.data.level;
                    var path = data.node.data.path;
                    var termIndexRoot = plugin.settings.termindex_root;
                    var type = plugin.settings.type;
                    data.result = {
                        url: plugin.buildQuery(termIndexRoot, type, path, lvla, lvlb)
                    }
                },

                glyph: {
                    map: {
                        doc: "",
                        docOpen: "",
                        error: "glyphicon glyphicon-warning-sign",
                        expanderClosed: "glyphicon glyphicon-plus-sign",
                        expanderLazy: "glyphicon glyphicon-plus-sign",
                        // expanderLazy: "glyphicon glyphicon-expand",
                        expanderOpen: "glyphicon glyphicon-minus-sign",
                        // expanderOpen: "glyphicon glyphicon-collapse-down",
                        folder: "",
                        folderOpen: "",
                        loading: "glyphicon glyphicon-refresh"
                        //              loading: "icon-spinner icon-spin"
                    }
                },

                create: function (evt, ctx) {
                },

                loadChildren: function (evt, ctx) {
                    var startId = plugin.settings.termindex_root_id;

                    if (startId) {
                        //ctx.tree.activateKey(startId);
                        var startNode = ctx.tree.getNodeByKey(startId);
                        if (startNode) {
                            //if (DEBUG) console.log("autoExpanding node: " + startNode.title + " (" + startNode.key + ")");
                            try {
                                startNode.setExpanded(true);
                                startNode.makeVisible();
                            } catch (e) {
                                console.error("autoExpand failed: " + e.toString())
                            }
                        }
                    }
                }

            });

            function decorateElementWithPopover(elem, key, title, path, caption) {
                //if (DEBUG) console.log("decorateElementWithPopover: "  + elem);
                if (jQuery(elem).popover) {
                    jQuery(elem).attr('rel', 'popover');

                    //if (DEBUG) console.log("caption = " + caption);
                    jQuery(elem).popover({
                            html: true,
                            content: function () {
                                caption = ((caption) ? caption : "");
                                var popover = "<div class='kmap-path'>/" + path + "</div>" + "<div class='kmap-caption'>" + caption + "</div>" +
                                    "<div class='info-wrap' id='infowrap" + key + "'><div class='counts-display'>...</div></div>";
                                //if (DEBUG) console.log("Captioning: " + caption);
                                return popover;
                            },
                            title: function () {
                                return title + "<span class='kmapid-display'>" + key + "</span>";
                            },
                            trigger: 'hover',
                            placement: 'left',
                            delay: {hide: 5},
                            container: 'body'
                        }
                    );

                    jQuery(elem).on('shown.bs.popover', function (x) {
                        $("body > .popover").removeClass("related-resources-popover"); // target css styles on search tree popups
                        $("body > .popover").addClass("search-popover"); // target css styles on search tree popups

                        var countsElem = $("#infowrap" + key + " .counts-display");

                        // highlight matching text (if/where they occur).
                        var txt = $('#searchform').val();
                        // $('.popover-caption').highlight(txt, {element: 'mark'});

                        $.ajax({
                            type: "GET",
                            url: plugin.settings.baseUrl + "/features/" + key + ".xml",
                            dataType: "xml",
                            timeout: 90000,
                            beforeSend: function () {
                                countsElem.html("<span class='assoc-resources-loading'>loading...</span>");
                            },
                            error: function (e) {
                                countsElem.html("<i class='glyphicon glyphicon-warning-sign' title='" + e.statusText);
                            },
                            success: function (xml) {

                                // force the counts to be evaluated as numbers.
                                var related_count = Number($(xml).find('related_feature_count').text());
                                var description_count = Number($(xml).find('description_count').text());
                                var place_count = Number($(xml).find('place_count').text());
                                var picture_count = Number($(xml).find('picture_count').text());
                                var video_count = Number($(xml).find('video_count').text());
                                var document_count = Number($(xml).find('document_count').text());
                                var subject_count = Number($(xml).find('subject_count').text());

                                if (plugin.settings.type === "places") {
                                    place_count = related_count;
                                } else if (plugin.settings.type === "subjects") {
                                    subject_count = related_count;
                                }
                                countsElem.html("");
                                countsElem.append("<span style='display: none' class='associated'><i class='icon shanticon-audio-video'></i><span class='badge' >" + video_count + "</span></span>");
                                countsElem.append("<span style='display: none' class='associated'><i class='icon shanticon-photos'></i><span class='badge' >" + picture_count + "</span></span>");
                                countsElem.append("<span style='display: none' class='associated'><i class='icon shanticon-places'></i><span class='badge' >" + place_count + "</span></span>");
                                countsElem.append("<span style='display: none' class='associated'><i class='icon shanticon-subjects'></i><span class='badge' >" + subject_count + "</span></span>");
                                countsElem.append("<span style='display: none' class='associated'><i class='icon shanticon-texts'></i><span class='badge' >" + description_count + "</span></span>");

                            },
                            complete: function () {

                                var fq = plugin.settings.solr_filter_query;

                                var project_filter = (fq) ? ("&" + fq) : "";
                                var kmidxBase = plugin.settings.kmindex_root;
                                if (!kmidxBase) {
                                    kmidxBase = 'http://kidx.shanti.virginia.edu/solr/kmindex';
                                    console.error("Drupal.settings.shanti_kmaps_admin.shanti_kmaps_admin_server_solr not defined. using default value: " + kmidxBase);
                                }
                                var solrURL = kmidxBase + '/select?q=kmapid:' + plugin.settings.type + '-' + key + project_filter + '&start=0&facets=on&group=true&group.field=asset_type&group.facet=true&group.ngroups=true&group.limit=0&wt=json';
                                //if (debug) console.log ("solrURL = " + solrURL);
                                $.get(solrURL, function (json) {
                                    //if (DEBUG) console.log(json);
                                    var updates = {};
                                    var data = JSON.parse(json);
                                    $.each(data.grouped.asset_type.groups, function (x, y) {
                                        var asset_type = y.groupValue;
                                        var asset_count = y.doclist.numFound;
                                        updates[asset_type] = asset_count;
                                    });
                                    // console.log(key + "(" + title + ") : " + JSON.stringify(updates));
                                    update_counts(countsElem, updates)
                                });
                            }
                        });
                    });
                }


                function update_counts(elem, counts) {

                    var av = elem.find('i.shanticon-audio-video ~ span.badge');
                    if (typeof(counts["audio-video"]) != "undefined") {
                        (counts["audio-video"]) ? av.html(counts["audio-video"]).parent().show() : av.parent().hide();
                    }
                    if (Number(av.text()) > 0) {
                        av.parent().show()
                    }

                    var photos = elem.find('i.shanticon-photos ~ span.badge');
                    if (typeof(counts.photos) != "undefined") {
                        photos.html(counts.photos)
                    }
                    (Number(photos.text()) > 0) ? photos.parent().show() : photos.parent().hide();

                    var places = elem.find('i.shanticon-places ~ span.badge');
                    if (typeof(counts.places) != "undefined") {
                        places.html(counts.places)
                    }
                    if (Number(places.text()) > 0) {
                        places.parent().show()
                    }

                    var essays = elem.find('i.shanticon-texts ~ span.badge');
                    if (typeof(counts.texts) != "undefined") {
                        essays.html(counts["texts"])
                    }
                    if (Number(essays.text()) > 0) {
                        essays.parent().show()
                    }

                    var subjects = elem.find('i.shanticon-subjects ~ span.badge');
                    if (typeof(counts.subjects) != "undefined") {
                        subjects.html(counts.subjects)
                    }
                    if (Number(subjects.text()) > 0) {
                        subjects.parent().show()
                    }
                    elem.find('.assoc-resources-loading').hide();

                }

                return elem;
            };

            function decorateElemWithDrupalAjax(theElem, theKey, theType) {
                //if (DEBUG) console.log("decorateElementWithDrupalAjax: "  + $(theElem).html());
                $(theElem).once('nav', function () {
                    //if (DEBUG) console.log("applying click handling to " + $(this).html());
                    var base = $(this).attr('id') || "ajax-wax-" + theKey;
                    var argument = $(this).attr('argument');
                    var url = location.origin + location.pathname.substring(0, location.pathname.indexOf(theType)) + theType + '/' + theKey + '/overview/nojs';

                    var element_settings = {
                        url: url,
                        event: 'navigate',
                        progress: {
                            type: 'throbber'
                        }
                    };

                    // if (DEBUG) console.log("Adding to ajax to " + base);

                    Drupal.ajax[base] = new Drupal.ajax(base, this, element_settings);
                    //this.click(function () {
                    //    if (DEBUG) console.log("pushing state for " + url);
                    //    window.history.pushState({tag: true}, null, url);
                    //});
                });
            }


        },
        yourOtherFunction: function (elem, settings) {
            // some logic
        },
        buildQuery: function (termIndexRoot, type, path, lvla, lvlb) {

            //if (DEBUG) console.log("termIndexRoot = " + termIndexRoot  + "\ntype = " + type + "\npath = " + path + "\nlvla  = " + lvla + "\nlvlb = " + lvlb);
            // clean up path (no "/" root!)
            path = path.replace(/^\//, "");

            var result =
                termIndexRoot + "/select?" +
                "q=ancestor_id_path:" + path +
                "&wt=json&indent=true&limit=" + SOLR_ROW_LIMIT +
                "&facet=true" +
                "&fl=header,id,ancestor_*,level_i" +
                "&indent=true" +
                "&fq=tree:" + type +
                "&fq=level_i:[" + lvla + "+TO+" + (lvlb + 1) + "]" +
                "&fq={!tag=hoot}level_i:[" + lvla + "+TO+" + lvlb + "]" +
                "&facet.mincount=2" +
                "&facet.limit=-1" +
                "&sort=level_i+ASC" +
                "&facet.sort=ancestor_id_path" +
                "&facet.field={!ex=hoot}ancestor_id_path" +
                "&wt=json" +
                "&rows=" + SOLR_ROW_LIMIT;

            if (DEBUG) {
                console.log("buildQuery():SOLR QUERY=" + result)
            }

            return result;
        },
        showPaths: function (paths, callback) {

            //console.log("ARGY!");
            //console.dir(arguments);
            var plugin = this;

            // ensure it is an array
            if (!$.isArray(paths)) {
                // wrap a single bare path into a single-value array.
                paths = [paths];
            }

            if (DEBUG) log("paths " + paths);

            var cleanPath = function (path, parentOnly, rootSlash) {
                log("cleanPath() args: " + JSON.stringify(arguments, undefined, 2));
                log("cleanPath() in: " + path);
                // Eliminate initial/terminal slash
                path = path.replace(/^\/+/, '');
                path = path.replace(/\/$/, '');
                var p = path.split('/');
                if (parentOnly) {
                    p.splice(-1, 1)
                }
                path = rootSlash ? "/" : "";
                path += p.join('/');
                var msg = "cleanPath() out: " + path;
                log(msg);
                return path;
            };

            //
            //
            //
            ////  Cleanup and re-root the paths
            var fixPath = function (path, i) {
                path = cleanPath(path);

                log("fixPath(): root_kmap_path = " + plugin.settings.root_kmap_path);

                var rootpath = cleanPath(plugin.settings.root_kmap_path, true, false);
                log("fixPath(): rootpath = " + rootpath);
                log("fixPath(): path = " + path);

                path = path.replace(rootpath, "");
                log("fixPath(): fixed path = " + path);

                // truncate the beginning of the path according to kmap_root_path
                var clean = cleanPath(path, false, true);
                log("fixPath(): fixed clean = " + clean);

                return clean;
            };

            paths = $.map(paths, fixPath);

            console.dir(paths);

            var showPaths = [];
            for (var i = 0; i < paths.length; i++) {
                if (this.element.fancytree('getTree').getNodeByKey(paths[i].substring(paths[i].lastIndexOf('/') + 1)) == null) {
                    showPaths.push(paths[i]);
                }
            }
            if (DEBUG) log("loadKeyPath " + showPaths);

            if (paths !== null) {
                if (showPaths.length == 0) {
                    var ret = this.element.fancytree('getTree').filterNodes(function (x) {
                        if (DEBUG) log("     filt:" + x.getKeyPath());
                        return $.inArray(x.getKeyPath(), paths) !== -1;
                        // unfortunately filterNodes does not implement a callback for when it is done AFAICT
                    }, {autoExpand: true});
                    if (DEBUG) log("filterNodes returned: " + ret);
                }
                else {
                    this.loadKeyPath(this.element.fancytree("getTree"), showPaths,
                        function (node, state) {
                            if (DEBUG) log("Terminal callback");
                            if (DEBUG) console.dir(node);
                            if (DEBUG) console.dir(state);

                            if (node === null) {
                                console.error("HEY NODE IS NULL");
                                console.error("paths = " + JSON.stringify(showPaths));
                            }

                            if (state === "ok") {
                                log("state = OK");
                                if (node != null) {
                                    if (DEBUG) log("ok " + node);
                                    var ret = node.tree.filterNodes(function (x) {
                                        if (DEBUG) log("     filt:" + x.getKeyPath());
                                        return $.inArray(x.getKeyPath(), paths) !== -1;
                                        // unfortunately filterNodes does not implement a callback for when it is done AFAICT
                                    }, {autoExpand: true});
                                    if (DEBUG) log("filterNodes returned: " + ret);
                                }
                            } else if (state == "loading") {
                                if (DEBUG) log("loading " + node);
                            } else if (state == "loaded") {
                                if (DEBUG) log("loaded" + node);
                            } else if (state == "error") {
                                console.error("ERROR: state was " + state + " for " + node);
                            }

                        }
                    ).always(
                        // The logic here is not DRY, so will need to refactor.
                        function () {
                            if (callback) {
                                if (DEBUG) {
                                    log("Calling back! ");
                                    console.dir(arguments);
                                }
                                callback();
                            }
                        }
                    );
                }
            } else {
                if (callback) callback();
            }
        },
        loadKeyPath: function(tree, keyPathList, callback, _rootNode) {
            var deferredList, dfd, i, path, key, loadMap, node, root, segList,
                sep = tree.options.keyPathSeparator,
                self = tree;

            if(!$.isArray(keyPathList)){
                keyPathList = [keyPathList];
            }
            // Pass 1: handle all path segments for nodes that are already loaded
            // Collect distinct top-most lazy nodes in a map
            loadMap = {};

            for(i=0; i<keyPathList.length; i++){
                root = _rootNode || self.rootNode;
                path = keyPathList[i];
                // strip leading slash
                if(path.charAt(0) === sep){
                    path = path.substr(1);
                }
                // traverse and strip keys, until we hit a lazy, unloaded node
                segList = path.split(sep);
                while(segList.length){
                    key = segList.shift();
//                node = _findDirectChild(root, key);
                    node = root._findDirectChild(key);
                    if(!node){
                        self.warn("loadKeyPath: key not found: " + key + " (parent: " + root + ")");
                        callback.call(self, key, "error");
                        break;
                    }else if(segList.length === 0){
                        callback.call(self, node, "ok");
                        break;
                    }else if(!node.lazy || (node.hasChildren() !== undefined )){
                        callback.call(self, node, "loaded");
                        root = node;
                    }else{
                        callback.call(self, node, "loaded");
//                    segList.unshift(key);
                        if(loadMap[key]){
                            loadMap[key].push(segList.join(sep));
                        }else{
                            loadMap[key] = [segList.join(sep)];
                        }
                        break;
                    }
                }
            }
//        alert("loadKeyPath: loadMap=" + JSON.stringify(loadMap));
            // Now load all lazy nodes and continue itearation for remaining paths
            deferredList = [];
            // Avoid jshint warning 'Don't make functions within a loop.':
            function __lazyload(key, node, dfd){
                callback.call(self, node, "loading");
                node.load().done(function(){
                    self.loadKeyPath.call(self, loadMap[key], callback, node).always(_makeResolveFunc(dfd, self));
                }).fail(function(errMsg){
                    self.warn("loadKeyPath: error loading: " + key + " (parent: " + root + ")");
                    callback.call(self, node, "error");
                    dfd.reject();
                });
            }
            for(key in loadMap){
                node = root._findDirectChild(key);
                if (node == null) {
                    node = self.getNodeByKey(key);
                }
//            alert("loadKeyPath: lazy node(" + key + ") = " + node);
                dfd = new $.Deferred();
                deferredList.push(dfd);
                __lazyload(key, node, dfd);
            }
            // Return a promise that is resovled, when ALL paths were loaded
            return $.when.apply($, deferredList).promise();
        },
        getNodeByKey: function (key, root) {
            return this.element.fancytree("getTree").getNodeByKey(key, root);
        },
        hideAll: function (cb) {
            var ftree = this.element.fancytree("getTree");
            ftree.filter(function (x) {
                return false;
            });
            cb(ftree);
        },
        reset: function (cb) {
            this.element.fancytree("getTree").clearFilter();
            if (cb) {
                cb();
            }
        },
        // Utility Functions
        sendEvent: function (handler, event, data) {
            function encapsulate(eventtype, event, n) {
                return {
                    eventtype: eventtype, // "useractivate","codeactivate"
                    title: n.title,
                    key: n.key,
                    path: "/" + n.data.path,
                    level: n.data.level,
                    parent: "/" + n.data.parent,
                    event: event
                }
            }

            // log("HANDLER:  " + handler);
            var kmapid = this.settings.type + "-" + data.node.key;
            var path = "/" + data.node.data.path;
            var origEvent = (event.originalEvent) ? event.originalEvent.type : "none";
            var keyCode = "";
            if (event.keyCode) {
                keyCode = "(" + event.keyCode + ")";
            }
            if (event.type === "fancytreeactivate" && origEvent === "click") {
                // This was a user click
                console.error("USER CLICKED: " + data.node.title);
                $(this.element).trigger("useractivate", encapsulate("useractivate", event, data.node));
            } else if (event.type === "fancytreekeydown" && origEvent === "keydown") {
                // This was a user arrow key (or return....)
                console.error("USER KEYED: " + data.node.tree.getActiveNode() + " with " + event.keyCode);
                $(this.element).trigger("useractivate", encapsulate("useractivate", event, data.node.tree.getActiveNode()));
            } else if (event.type === "fancytreefocus" && origEvent === "none") {
                // console.error("FOCUS: " + data.node.title);
            } else if (event.type === "fancytreeactivate" && origEvent === "none") {
                // console.error("ACTIVATE: " + data.node.title);
                $(this.element).trigger("activate", encapsulate("codeactivate", event, data.node.tree.getActiveNode()));
            } else {
                log("UNHANDLED EVENT: " + event);
                console.dir(event);
            }
        }

    });

    //// A really lightweight plugin wrapper around the constructor,
    //// preventing against multiple instantiations
    //$.fn[pluginName] = function (options) {
    //    return this.each(function () {
    //        if (!$.data(this, "plugin_" + pluginName)) {
    //            $.data(this, "plugin_" + pluginName, new KmapsTreePlugin(this, options));
    //        }
    //    });
    //};

    // here we are making functions available outside the plugin.

    //$.fn[pluginName].loadKeyPath = function (path, func) {
    //    this.loadKeyPath(path, function() {
    //        if (DEBUG) log("loadKeyPath callback: " + path);
    //        tree.filterNodes(function (node, func) {
    //            var match = (node.getKeyPath() === path);
    //            if (DEBUG) (match + " = " + node.getKeyPath() + " ? " + path);
    //            return match;
    //        });
    //    });
    //};

    // See https://github.com/jquery-boilerplate/jquery-boilerplate/wiki/Extending-jQuery-Boilerplate
    $.fn[pluginName] = function (options) {
        var args = arguments;

        if (options === undefined || typeof options === 'object') {
            return this.each(function () {
                if (!$.data(this, 'plugin_' + pluginName)) {
                    $.data(this, 'plugin_' + pluginName, new KmapsTreePlugin(this, options));
                }
            });
        } else if (typeof options === 'string' && options[0] !== '_' && options !== 'init') {
            var returns;

            this.each(function () {
                var instance = $.data(this, 'plugin_' + pluginName);
                if (instance instanceof KmapsTreePlugin && typeof instance[options] === 'function') {
                    returns = instance[options].apply(instance, Array.prototype.slice.call(args, 1));
                }
                if (options === 'destroy') {
                    $.data(this, 'plugin_' + pluginName, null);
                }
            });
            return returns !== undefined ? returns : this;
        }
    };


})(jQuery, window, document);
