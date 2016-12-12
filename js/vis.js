"use strict";

(function (window) {
    var lastTime = 0;
    var vendors = ['ms', 'moz', 'webkit', 'o'];
    var id;
    for (var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x] + 'RequestAnimationFrame'];
        window.cancelAnimationFrame =
            window[vendors[x] + 'CancelAnimationFrame'] || window[vendors[x] + 'CancelRequestAnimationFrame'];
    }

    if (!window.requestAnimationFrame)
        window.requestAnimationFrame = function (callback, element) {
            var currTime = new Date().getTime();
            // var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var timeToCall = Math.max(40, (currTime - lastTime));
            clearTimeout(id);
            id = window.setTimeout(function () {
                    callback();
                },
                timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };

    if (!window.cancelAnimationFrame)
        window.cancelAnimationFrame = function (id) {
            clearTimeout(id);
        };
})(window);

var vis = {};

var setting = {
    childLife: 5 // number of steps of life a child
    // , parentLife: 0 // number of steps of life a parent
    , showHalo: true // show a child's halo
    , padding: 5 // padding around a parent
    , rateOpacity: .5 // rate of decrease of opacity
    , rateFlash: 2.5 // rate of decrease of flash
    // , sizeParent: 0 // size of parent
};

var asyncForEach = function (items, fn, time) {
    if (!(items instanceof Array))
        return;
    var timeout;

    var workArr = items.reverse().concat();

    function loop() {
        // console.log('loop2');
        if (workArr.length > 0)
            fn(workArr.shift(), workArr);
        if (workArr.length > 0) {
            clearTimeout(timeout);
            timeout = setTimeout(loop, time || 1);
        }
    }

    loop();
};

var shortTimeFormat = (function () {
    var fd = d3.time.format("%d.%b.%y");
    return function (ms) {
        return fd(new Date(ms/* - TIME_ZONE*/));
    }
})();

var ONE_SECOND = 1000,
    stepDate = 24 * 60 * 60 * 1000;

(function (vis) {

    var PI_CIRCLE = Math.PI * 2;

    var _worker,
        _data,
        nodes,
        dateRange,
        selected,
        selectedExt,

        colorless = d3.rgb("gray"),
        colorlessFlash = d3.rgb("lightgray"),

        parentHash,
        childHash,
        extHash,
        // extMax,

        _force,

        // links,

        canvas, ctx,
        bufCanvas, bufCtx,
        layer,

        valid,

        particle,

        lastEvent,
        _w, _h,

        setting,
        rd3 = d3.random.irwinHall(8)
        ;

    var extColor = d3.scale.category20();
    //     baseColor = d3.scale.category20b();
    //
    // var typeNode = {
    //     parent: 0,
    //     child: 1
    // };

    particle = new Image();
    particle.src = "img/particle.png";


    function reCalc(d) {
        // console.log(d)
        var l = d.nodes.length,
            n;
        // console.log(d.parentNode)
        // a = d.parentNode;
        // a.relations = a.relations || {};
        // a.fixed = a.x instanceof Object || a.y instanceof Object ? true : false;

        // if (!l)
        //     console.log(d);
        // else {
        //     // a.alive = setting.parentLife > 0 ? setting.parentLife : 1;
        //     a.opacity = 100;
        //     a.flash = 100;
        //     a.visible = true;
        // }

        while (--l > -1) {
            n = d.nodes[l];

            if (n.fixed) {
                n.x = d.parent.x; //a.x;
                n.y = d.parent.y;  //a.y;
                n.paths = [{x: n.x, y: n.y}];
                n.msize = n.size;
                n.size *= 3;
            }
            else {
                n.size = n.hasOwnProperty("msize") ? n.msize : n.size;
                delete n["msize"];
            }

            //n.size += 2;
            n.fixed = false;

            // n.parent = d.parent;

            n.visible = true;

            n.flash = 100;
            n.opacity = 100;
            n.alive = setting.childLife > 0 ? setting.childLife : 1;

            if (n.visible) {
                n.ext.now.indexOf(n.id) < 0
                && n.ext.now.push(n.id);
            }
            else {
                (n.id = n.ext.now.indexOf(n.id)) > -1
                && n.ext.now.splice(parseInt(n.id), 1);

                n.flash *= .5;
                n.alive *= .2;
                n.opacity *= .5;
            }

            // var key = a.id + "_" + n.id,
            //     src = a,
            //     trg = n,
            //     bid = n.nodeValue.borrower.key,
            //     sid = n.nodeValue.supplier.key
            //
            //     ;
            //
            // if (a.id != bid && !a.relations.hasOwnProperty(bid)) {
            //     a.relations[bid] = n.nodeValue.borrower;
            // } else if (a.id != sid && !a.relations.hasOwnProperty(sid)) {
            //     a.relations[sid] = n.nodeValue.supplier;
            // }
            //
            // if (n.nodeValue.borrower == a.nodeValue) {
            //     key = n.id + "_" + a.id;
            //     src = n;
            //     trg = a;
            // }
            //
            // if (!links.has(key))
            //     links.set(key, {
            //         key: key,
            //         source: src,
            //         target: trg
            //     });
            //
            // if (n.nodeValue.supplier == n.nodeValue.borrower) {
            //     key = n.id + "_" + a.id;
            //     if (!links.has(key))
            //         links.set(key, {
            //             key: key,
            //             source: trg,
            //             target: src
            //         });
            // }
        }

        _force.nodes(nodes.filter(function (d) {
                return d.visible || d.opacity;
            })
        ).start();
    }

    function loop() {
        console.log('loop');

        var dl, dr;

        dl = dateRange[0];
        dr = dl + stepDate;
        dateRange[0] = dr;

        var visTurn = _data.filter(function (d) {
            return d.date >= dl && d.date < dr;
        });

        asyncForEach(visTurn, reCalc, ONE_SECOND / (visTurn.length > 1 ? visTurn.length : ONE_SECOND));

        if (dl >= dateRange[1]) {
            if (typeof _worker !== "undefined") {
                clearTimeout(_worker);
            }
            return;
        } else {
            if (!visTurn.length) {
                // console.log('recursion loop');
                loop();
            }
        }

        clearTimeout(_worker);
        _worker = setTimeout(loop, ONE_SECOND);
    }

    function run() {
        // console.log('run');

        render();

        clearTimeout(_worker);
        _worker = setTimeout(loop, ONE_SECOND);
    }

    function nr(d) {
        return d.size > 0 ? d.size : 0;
    }

    function curColor(d) {
        var ext = selectedExt;

        if (!ext && selected) {
            if (selected.ext)
                ext = selected.ext;
        }

        return ext && ext.color && ext.color !== d.d3color
            ? d.flash ? colorlessFlash : colorless
            : d.flash ? d.flashColor : d.d3color;
    }

    function curOpacity(d) {

        var ext = selectedExt;

        if (!ext && selected) {
            if (selected.ext)
                ext = selected.ext;
        }

        return ext && ext.color && ext.color !== d.d3color
            ? 20 : d.opacity;
    }

    function randomTrue() {
        return Math.floor(rd3() * 8) % 2;
    }

    function radius(d) {
        return Math.sqrt(d);
    }

    function contain(d, pos) {
        var px = (lastEvent.translate[0] - pos[0]) / lastEvent.scale,
            py = (lastEvent.translate[1] - pos[1]) / lastEvent.scale,
            r = Math.sqrt(Math.pow(d.x + px, 2) +
                Math.pow(d.y + py, 2));
        return r < (/*d.type == typeNode.parent ? nr(d) * 1.5 : */radius(nr(d)));
    }

    function getNodeFromPos(pos) {
        for (var i = nodes.length - 1; i >= 0; i--) {
            var d = nodes[i];
            if (d.visible && contain(d, pos))
                return d;
        }
        return null;
    }

    function node(d) {
        // console.log(d, type)
        var c,
            ext;

        c = d['Major Sector'];
        ext = extHash.get(c);
        if (!ext) {
            ext = {
                values: {},
                color: d3.rgb(extColor(c)),
                now: []
            };
            extHash.set(c, ext);
        }
        c = ext.color;

        return {
            x: _w * Math.random(),
            y: _h * Math.random(),
            id: d.id,
            size: d.size || 2,
            weight: d.size || 2,
            fixed: true,
            links: 0,
            // type: type,
            color: c.toString(),
            d3color: c,
            flashColor: c.brighter().brighter(),
            ext: ext,
            nodeValue: d
        }
    }

    // function getBase(d) {
    //     if (!d || !d.parent)
    //         return null;
    //
    //     var pkey = d.parent.key;
    //
    //     var n = parentHash.get(pkey);
    //
    //     if (!n) {
    //         n = node(d.parent, typeNode.parent);
    //         parentHash.set(pkey, n);
    //     }
    //     return n;
    // }

    function getChild(d) {
        if (!d)
            return null;

        var key = d.id;

        var n = childHash.get(key);

        if (!n) {
            n = node(d);
            n.links = 1;
            childHash.set(key, n);
        }
        return n;
    }

    function initNodes(data) {
        var ns = [],
            i, j, n, d, df;
        parentHash = d3.map({});
        childHash = d3.map({});
        extHash = d3.map({});
        // extMax = 0;

        if (data) {
            i = data.length;
            while (--i > -1) {
                d = data[i];
                if (!d) continue;
                d.nodes = [];

                // console.log('1', d);
                // n = getBase(d);
                // console.log('2', n);
                // d.parentNode = n;
                // !n.inserted && (n.inserted = ns.push(n));

                n = getChild(d);
                // console.log('3', n);
                n.parent = d.parent;
                d.nodes.push(n);
                // n.ext.currents[shortTimeFormat(d.date)] = (n.ext.currents[shortTimeFormat(d.date)] || 0);
                // n.ext.currents[shortTimeFormat(d.date)]++;
                // n.ext.values['_' + d.id] = +d;
                !n.inserted && (n.inserted = ns.push(n));

                // j = extHash.values().reduce((function (id) {
                //     return function (a, b) {
                //         return (a || 0) + (b.currents[id] || 0);
                //     }
                // })(shortTimeFormat(d.date)), null);
                //
                // extMax = j > extMax ? j : extMax;
            }
        }
        return ns;
    }

    var tempFileCanvas;

    function colorize(img, r, g, b, a) {
        if (!img)
            return img;

        if (!tempFileCanvas)
            tempFileCanvas = document.createElement("canvas");

        if (tempFileCanvas.width != img.width)
            tempFileCanvas.width = img.width;

        if (tempFileCanvas.height != img.height)
            tempFileCanvas.height = img.height;

        var imgCtx = tempFileCanvas.getContext("2d"),
            imgData, i;
        imgCtx.drawImage(img, 0, 0);

        imgData = imgCtx.getImageData(0, 0, img.width, img.height);

        i = imgData.data.length;
        while ((i -= 4) > -1) {
            imgData.data[i + 3] = imgData.data[i] * a;
            if (imgData.data[i + 3]) {
                imgData.data[i] = r;
                imgData.data[i + 1] = g;
                imgData.data[i + 2] = b;
            }
        }

        imgCtx.putImageData(imgData, 0, 0);
        return tempFileCanvas;
    }

    function blink(d, aliveCheck) {
        d.flash = (d.flash -= setting.rateFlash) > 0 ? d.flash : 0;

        !d.flash && aliveCheck
        && (d.alive = (d.alive-- > 0 ? d.alive : 0))
        ;

        d.opacity = !d.alive
            ? ((d.opacity -= setting.rateOpacity) > 0 ? d.opacity : 0)
            : d.opacity
        ;

        d.visible && !d.opacity
        && (d.visible = false);

        if (d.paths) {
            d.pathLife = (d.pathLife || 0);
            if (d.pathLife++ > 0) {
                d.pathLife = 0;
                if (d.paths.length)
                    d.paths.shift();
            }
        }
    }

    function sortBySize(a, b) {
        return d3.ascending(a.size, b.size);
    }

    function checkVisible(d, offsetx, offsety) {
        var tx = lastEvent.translate[0] / lastEvent.scale,
            ty = lastEvent.translate[1] / lastEvent.scale
            ;

        // offsetx = offsetx || 0;
        // if (!(offsetx instanceof Array))
        //     offsetx = [offsetx, offsetx];
        // offsety = offsety || 0;
        // if (!(offsety instanceof Array))
        //     offsety = [offsety, offsety];

        return (
            d.x + d.size > -tx
            && d.x - d.size < -tx + _w / lastEvent.scale
            && d.y + d.size > -ty
            && d.y - d.size < -ty + _h / lastEvent.scale
        );
    }

    function sortByColor(a, b) {
        return d3.ascending(b.color + !b.flash, a.color + !a.flash);
    }

    function sortByOpacity(a, b) {
        return d3.ascending(curOpacity(b), curOpacity(a));
    }

    function compereColor(a, b) {
        return a.r != b.r || a.g != b.g || a.b != b.b;
    }

    function filterVisible(d) {
        return checkVisible(d) && (d.visible || d.alive);
    }

    function redrawCanvas() {

        bufCtx.save();
        bufCtx.clearRect(0, 0, _w, _h);

        bufCtx.translate(lastEvent.translate[0], lastEvent.translate[1]);
        bufCtx.scale(lastEvent.scale, lastEvent.scale);

        var n, l, i, j,
            src, trg,
            iw, ih,
            img,
            d, beg,
            c, x, y, s;


        n = _force.nodes()
            .filter(filterVisible)
            // .sort(sortBySize)
            // .sort(sortByOpacity)
            .sort(sortByColor)
        ;

        l = n.length;

        c = null;
        i = 100;
        j = true;
        beg = false;

        bufCtx.globalAlpha = i * .01;

        while (--l > -1) {
            d = n[l];

            if (i != curOpacity(d)) {
                i = curOpacity(d);
                bufCtx.globalAlpha = i * .01;
            }

            if (!c || compereColor(c, curColor(d))) {
                // console.log(c)
                c = curColor(d);
                j = false;
            }

            if (!j) {
                img = colorize(particle, c.r, c.g, c.b, 1);
                j = true;
            }

            x = Math.floor(d.x);
            y = Math.floor(d.y);

            bufCtx.lineCap = "round";
            //bufCtx.lineJoin="round";
            bufCtx.lineWidth = (radius(nr(d)) / 4) || 1;
            bufCtx.fillStyle = "none";
            bufCtx.strokeStyle = c.toString();

            var rs = d.paths.slice(0).reverse(),
                lrs = rs.length,
                cura = bufCtx.globalAlpha;

            for (var p in rs) {
                if (!rs.hasOwnProperty(p))
                    continue;

                bufCtx.beginPath();
                if (p < 1)
                    bufCtx.moveTo(x, y);
                else
                    bufCtx.moveTo(
                        Math.floor(rs[p - 1].x),
                        Math.floor(rs[p - 1].y)
                    );
                bufCtx.lineTo(
                    Math.floor(rs[p].x),
                    Math.floor(rs[p].y)
                );
                bufCtx.stroke();
                bufCtx.globalAlpha = ((lrs - p) / lrs) * cura;
            }
            //bufCtx.restore();
            bufCtx.globalAlpha = cura;


            s = radius(nr(d)) * (setting.showHalo ? 8 : 1);
            setting.showHalo
                ? bufCtx.drawImage(img, x - s / 2, y - s / 2, s, s)
                : bufCtx.arc(x, y, s, 0, PI_CIRCLE, true)
            ;
        }

        bufCtx.restore();
    }

    function render() {

        if (valid)
            return;

        console.log('render');
        requestAnimationFrame(render);

        valid = true;

        ctx.save();
        ctx.clearRect(0, 0, _w, _h);

        redrawCanvas();

        ctx.drawImage(bufCanvas, 0, 0);
        ctx.restore();

        valid = false;
    }

    function tick() {
        if (_force.nodes()) {

            _force.nodes()
                .forEach(cluster(0.025));
        }
        
        _force.resume();
    }

    // Move d to be adjacent to the cluster node.
    function cluster(alpha) {

        parentHash.forEach(function (k, d) {
            d.links = 0;
        });

        return function (d) {
            blink(d, setting.childLife > 0);
            if (!d.parent || !d.visible)
                return;

            var node = d.parent,
                l,
                r,
                x,
                y;

            if (node == d) return;
            node.links++;

            x = d.x - node.x;
            y = d.y - node.y;
            l = Math.sqrt(x * x + y * y);
            r = radius(nr(d)) / 2 + (nr(node) + setting.padding);
            if (l != r) {
                l = (l - r) / (l || 1) * (alpha || 1);
                x *= l;
                y *= l;

                d.x -= x;
                d.y -= y;
            }
            d.paths && (d.flash/* || d.paths.length > 2*/) && d.paths.push({
                x: d.x,
                y: d.y
            });
        };
    }

    var tooltip;

    function showToolTip(d) {
        var res;
        if (!d) {
            tooltip.style("display", "none");
            return;
        }
        if (tooltip.style("display") == "none") {
            res = [
                "Date: <b>",
                shortTimeFormat(d.nodeValue.date),
                "</b>",
                "<br/>",
                "Supplier: ",
                d.nodeValue.supplier.img && d.nodeValue.supplier.img.width > 0 && d.nodeValue.supplier.img.height > 0 ? d.nodeValue.supplier.img.outerHTML : "",
                "<b>",
                d.nodeValue.supplier.name,
                "</b><br/>",
                "Borrower: ",
                d.nodeValue.borrower.img && d.nodeValue.borrower.img.width > 0 && d.nodeValue.borrower.img.height > 0 ? d.nodeValue.borrower.img.outerHTML : "",
                "<b>",
                d.nodeValue.borrower.name,
                "</b><br/>",
                "Amount: ",
                "<b>",
                d.nodeValue.amount,
                "</b><br/>"
            ];

            tooltip.html(res.join(''));
            tooltip.style("display", "block");
        }
    }

    function moveToolTip(d, event) {
        event = event || d3.event;
        if (d && event) {
            tooltip
                .style("top", event.pageY > _h / 2 ? (event.pageY - tooltip.node().clientHeight - 16) + "px" : (event.pageY + 16) + "px")
                .style("left", event.pageX > _w / 2 ? (event.pageX - tooltip.node().clientWidth - 16) + "px" : (event.pageX + 16) + "px")
            ;
        }
    }

    function movem(d) {
        var item = arguments.length > 1 && arguments[1] instanceof HTMLCanvasElement ? arguments[1] : this;
        d = null;
        if (selected) {
            var od = selected;
            if (contain(od, d3.mouse(item)))
                d = od;
            if (!d) {
                od && (od.fixed &= 3);
                selected = null;
                d3.select("body").style("cursor", "default");
            }
        }
        else
            d = getNodeFromPos(d3.mouse(item));

        if (d) {
            selected = d;
            d.fixed |= 4;
            d3.select("body").style("cursor", "pointer");
        }
        showToolTip(d, d3.event);
        moveToolTip(d, d3.event);
    }

    vis.runShow = function (data, dom, w, h, asetting) {
        // console.log(data, dom, w, h, asetting);

        if (typeof _worker !== "undefined")
            clearTimeout(_worker);

        _data = data.sort(function (a, b) {
            return d3.ascending(a, b)
        });
        _w = w;
        _h = h;

        if (!_data || !_data.length)
            return;

        setting = asetting;

        extColor = d3.scale.category20();

        dateRange = d3.extent(data, function (d) {
            return d.date;
        });

        layer = dom;
        layer.selectAll("*").remove();

        lastEvent = {
            translate: [0, 0],
            scale: 1
        };

        canvas = layer.append("canvas")
            .text("This browser don't support element type of Canvas.")
            .attr("id", "mainCanvas")
            .attr("width", w)
            .attr("height", h)
            .node();

        tooltip = tooltip || d3.select(document.body).append("div").attr("class", "tooltip");
        tooltip.style("display", "none");

        ctx = canvas.getContext("2d");

        bufCanvas = document.createElement("canvas");
        bufCanvas.width = w;
        bufCanvas.height = h;

        bufCtx = bufCanvas.getContext("2d");
        // bufCtx.globalCompositeOperation = 'lighter';

        // bufCtx.font = "normal normal " + setting.sizeParent / 2 + "px Tahoma";
        // bufCtx.textAlign = "center";

        d3.select(dom.node().parentNode).select("#s").remove();

        layer = d3.select(dom.node().parentNode)
            .append("div")
            .attr("id", "s")
                .append("svg")
                .attr('width', w)
                .attr("height", h)
                    .append("g")
                    .call(setting.zoom)
                    .on('mousemove.tooltip', movem)
                        .append("rect")
                        .attr("width", w)
                        .attr("height", h);

        // links = d3.map({});
        nodes = initNodes(_data);

        _force = (_force || d3.layout.force()
            .stop()
            .size([w, h])
            .friction(.75)
            .gravity(0)
            //.charge(function(d) {return -1 * radius(nr(d)); } )
            .charge(-.5)
            .on("tick", tick))
            .nodes([]);

        run();
        _force.start();
    };

})(vis || (vis = {}));