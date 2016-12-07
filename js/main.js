(function() {
    var w, h,
        _data,
        div
        ;

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

    var countriesCounter = 0,
        countries = {},
        countryByIndex = [],
        failCountryCoord,
        needPaintCapital = [],
        projects
        ;

    function preload(d) {
        if (!d)
            return;
        d.img = new Image();
        d.img.onerror = (function(img) {
            return function() {
                console.log('error load url:' + d.img.src);
                d.img = null;
            }
        })(d);
        d.img.src = "flags/" + d.key.toLowerCase() + '.png';
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

    // return object country
    function initCounty(key, value) {
        var c = countries[key] || ( countries[key] = {
                key: key,
                name: value,
                shortName: value.split(',')[0],
                borrowed : 0,
                supplied : 0,
                id: countriesCounter++,
                toString : function(full) {
                    return full ? this.name : this.shortName;
                }
            });
        if (!countryByIndex[c.id]) {
            var cc = wbc.getByIsoId(c.key)
                ;
            if (!cc) {
                cc = failCountryCoord[c.key];
                if (!cc) {
                    cc = {
                        longitude : -50 + (10 * failCountryCoord.length++),
                        latitude : 80,
                        capitalCity : c.shortName
                    };
                    failCountryCoord[c.key] = cc;
                }
            }
            cc.init = true;
            c.capitalCity = {
                name : cc.capitalCity,
                coord : coord(cc.longitude, cc.latitude)
            };
            c.x = c.capitalCity.coord.x;
            c.y = c.capitalCity.coord.y;

            needPaintCapital.push(cc);

            preload(c);
        }
        return countryByIndex[c.id] = c;
    }

    function initProcurement(d) {
        return {
            category : d['Procurement Category'],
            method : d['Procurement Method'],
            type : d['Procurement Type']
        };
    }

    function initContract(d) {
        return {
            desc : d['Contract Description'],
            date : Date.parse(d['Contract Signing Date'])
        };
    }

    function initProject(d) {
        return projects[d['Project ID']] || (projects[d['Project ID']] = {
                name : d['Project Name'],
                id : d['Project ID'],
                toString : function() {
                    return this.name;
                }
            });
    }

    function value() {
        return this.basevalue || 0;
    }

    function initItem(d) {
        // console.log(d)
        // Convert strings to numbers.
        d.value = d.basevalue = parseInt(d["Total Contract Amount (USD)"].substring(1));
        d.valueOf = value;

        d.borrower = initCounty(d["Borrower Country Code"], d["Borrower Country"]);
        d.borrower.borrowed += d.value;
        d.supplier = initCounty(d["Supplier Country Code"], d["Supplier Country"]);
        d.supplier.supplied += d.value;
        d.sector = d["Major Sector"];
        d.product = d['Product line'];
        d.procurement = initProcurement(d);
        d.contract = initContract(d);
        d.year = d['Fiscal Year'];
        d.project = initProject(d);
        d.id = d['WB Contract Number'] + d.project.id + d.supplier.key + d.borrower.key;
        d.date = d.contract.date;
        d.asdate = Date.parse(d['As of Date']);

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
        return b.contract.date - a.contract.date;
    }

    var sizes = d3.scale.linear()
        .range([4, 400]);

    var projection = d3.geo.mercator();

    var path = d3.geo.path()
        .projection(projection);

    function ctr(d) {
        return "translate(" + projection([d.longitude, d.latitude]) + ")";
    }

    var zoom = d3.behavior.zoom()
        .on("zoom", function() {
            projection.translate(d3.event.translate).scale(d3.event.scale);
            feature.attr("d", path);
            circle.attr("transform", ctr);
        })
        ;

    var fsvg = d3.select(document.body)
        .append("div")
        .attr("id", "map")
        .append("svg");

    var feature = fsvg
        .selectAll("path.feature");

    var circle;

    function request(error, data) {
        var l, a, b;
        projects = {};
        countriesCounter = 0;
        countries = {};
        countryByIndex = [];
        failCountryCoord = {length : 0};
        needPaintCapital = [];

        data = data.map(initItem);
        l = data.length;
        sizes.domain(d3.extent(data));

        _data = [];
        while(--l > -1) {
            a = data[l];
            a.size = sizes(+a);
            b = clone(a);
            a.parent = a.supplier;
            b.parent = b.borrower;
            a.date = a.date - stepDate /*/2*/;
            _data.push(a);
            _data.push(b);
        }
        _data.sort(sortByCSD);

        div = div || d3.select(document.body).append("div").attr("id", "c");
        w = document.body.clientWidth;
        h = document.body.clientHeight;

        projection
            .scale(w/6.5)
            .translate([w / 2, h / 1.6])
        ;

        zoom.translate(projection.translate())
            .scale(projection.scale())
            .scaleExtent([h / 6, h])
        ;

        feature.attr("d", path);

        fsvg.selectAll("circle").remove();

        circle = fsvg.selectAll("circle")
            .data(needPaintCapital)
            .enter()
            .append("circle")
            .attr("r", 1)
            .attr("fill", "#fff")
            .attr("transform", ctr);

        setting.zoom = zoom;

        vis.runShow(_data, div, w, h, setting);
    }

    d3.json("world-countries.json", function (error, collection) {
        // console.log(collection)
        feature = feature
            .data(collection.features)
            .enter().append("path")
            .attr("class", "feature")
        ;

        d3.csv('request/2013.csv', request);
    });
})();