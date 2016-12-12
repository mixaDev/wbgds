(function() {
    var
        w = document.body.clientWidth,
        h = document.body.clientHeight,
        _data = [],
        div = d3.select(document.body)
            .append("div")
            .attr("id", "c");

    // var sizes = d3.scale.linear() //  построить линейную шкалу количественного.
    //     .range([4, 400]);

    var projection = d3.geo.mercator() // сферическая проекция Меркатора.
        .scale(w/3) // 6.5
        .translate([w / 2, h / 1.6]);

    var path = d3.geo.path()   // создать новый генератор географический путь
        .projection(projection); // получить или установить географическую проекцию.

    var zoom = d3.behavior.zoom()
        .translate(projection.translate())
        .scale(projection.scale())
        .scaleExtent([h / 6, h])
        .on("zoom", function() {
            projection.translate(d3.event.translate).scale(d3.event.scale);
            feature.attr("d", path);
            circle.attr("transform", ctr);
        });

    var fsvg = d3.select(document.body)
        .append("div")
        .attr("id", "map")
        .append("svg");

    var feature = fsvg.selectAll("path.feature");
    var circle = fsvg.selectAll("circle");

    setting.zoom = zoom;
    
    wbc.getByIsoId = function(id) {
        var c,
            l = wbc[1].length;
        while(--l > -1) {
            c = wbc[1][l];
            if (c.iso2Code == id)
                return c;
        }
        return null;
    };

    function preload(d) {
        if (!d)
            return;
        d.img = new Image();
        d.img.src = "flags/" + d.key.toLowerCase() + '.png';

        d.img.onerror = function() {
            console.log('error load url:' + d.img.src);
            d.img = null;
        };
    }

    function coord(x, y) {
        var c = [x, y];
        return {
            x : {
                valueOf : function() {
                    var p = projection(c);
                    return p[0];
                }
            },
            y : {
                valueOf : function() {
                    var p = projection(c);
                    return p[1];
                }
            }
        }
    }

    function initItemCounty(key) {
        var cc = wbc.getByIsoId(key);
        var coordinates = coord(cc.longitude, cc.latitude);

        var c = {
            key: key,
            name: cc.name,
            x: coordinates.x,
            y: coordinates.y
        };

        preload(c);

        return c;
    }

    function initItem(d) {
        d.amount = parseInt(d["Total Contract Amount (USD)"].substring(1));
        d.borrower = initItemCounty(d["Borrower Country Code"]);
        d.supplier = initItemCounty(d["Supplier Country Code"]);
        d.id = d['WB Contract Number'] + d.supplier.key + d.borrower.key;
        d.date = Date.parse(d['Contract Signing Date']);

        return d;
    }

    function clone(d) {
        var newItem = {};

        for (var key in d) {
            if (!d.hasOwnProperty(key))
                continue;
            newItem[key] = d[key];
        }
        return newItem;
    }

    function sortByCSD(a, b) {
        return b.date - a.date;
    }

    function ctr(d) {
        return "translate(" + projection([d.longitude, d.latitude]) + ")";
    }

    function request(error, data) {
        var l, a, b;

        data = data
            .filter(function(i){ return wbc.getByIsoId(i['Borrower Country Code']) && wbc.getByIsoId(i['Supplier Country Code'])})
            .map(initItem);
        l = data.length;
        // sizes.domain(d3.extent(data));

        while(--l > -1) {
            a = data[l];
            // a.size = sizes(+a);
            b = clone(a);
            a.parent = a.supplier;
            b.parent = b.borrower;
            a.date = a.date - stepDate;
            _data.push(a);
            _data.push(b);
        }
        _data.sort(sortByCSD);

        circle = circle
            .data(wbc[1])
            .enter()
            .append("circle")
            .attr("transform", ctr);

        vis.runShow(_data, div, w, h, setting);
    }

    d3.json("world-countries.json", function (error, collection) {
        feature = feature
            .data(collection.features)
            .enter()
            .append("path")
            .attr("class", "feature")
            .attr("d", path);

        d3.csv('request/2013.csv', request);
    });
})();