/*
 * Echarts-export
 * Version: 2.1.0
 *
 * Tool that would create charts by json file. It bases EChatrs.js
 *
 * https://github.com/HenriettaSu/Echarts-export
 *
 * License: MIT
 *
 * Released on: December 15, 2016
 */

var X = XLSX,
    XW = {
        msg: 'xlsx',
        rABS: '../../vendor/js-xlsx/xlsxworker2.js',
        norABS: '../../vendor/js-xlsx/xlsxworker1.js',
        noxfer: '../../vendor/js-xlsx/xlsxworker.js'
    },
    data,
    rABS = typeof FileReader !== "undefined" && typeof FileReader.prototype !== "undefined" && typeof FileReader.prototype.readAsBinaryString !== "undefined",
    use_worker = typeof Worker && window.location.href.match('http://') ? true : false,
    transferable = use_worker;

function fixdata(data) {
    var o = "", l = 0, w = 10240;
    for(; l<data.byteLength/w; ++l) o+=String.fromCharCode.apply(null,new Uint8Array(data.slice(l*w,l*w+w)));
    o+=String.fromCharCode.apply(null, new Uint8Array(data.slice(l*w)));
    return o;
}

function ab2str(data) {
    var o = "",
        l = 0,
        w = 10240;
    for(; l<data.byteLength/w; ++l) o+=String.fromCharCode.apply(null,new Uint16Array(data.slice(l*w,l*w+w)));
    o+=String.fromCharCode.apply(null, new Uint16Array(data.slice(l*w)));
    return o;
}

function s2ab(s) {
    var b = new ArrayBuffer(s.length*2),
        v = new Uint16Array(b);
    for (var i=0; i != s.length; ++i) v[i] = s.charCodeAt(i);
    return [v, b];
}

function xw_noxfer(data, cb) {
	var worker = new Worker(XW.noxfer);
	worker.onmessage = function(e) {
		switch(e.data.t) {
			case 'ready': break;
			case 'e': console.error(e.data.d); break;
			case XW.msg: cb(JSON.parse(e.data.d)); break;
		}
	};
	var arr = rABS ? data : btoa(fixdata(data));
	worker.postMessage({d:arr,b:rABS});
}

function xw_xfer(data, cb) {
    var worker = new Worker(rABS ? XW.rABS : XW.norABS);
    worker.onmessage = function(e) {
        switch(e.data.t) {
            case 'ready':
                break;
            case 'e':
                console.error(e.data.d);
                break;
            default:
                xx = ab2str(e.data).replace(/\n/g,"\\n").replace(/\r/g,"\\r");
                cb(JSON.parse(xx));
        }
    };
    if(rABS) {
        var val = s2ab(data);
        worker.postMessage(val[1], [val[1]]);
    } else {
        worker.postMessage(data, [data]);
    }
}

function xw(data, cb) {
    if (transferable) {
        xw_xfer(data, cb);
    } else {
        xw_noxfer(data, cb);
    }
}

function process_wb(workbook) {
    var result = [],
        chartType = $('#chartType').val();
    workbook.SheetNames.forEach(function(sheetName) {
        var worksheet = workbook.Sheets[sheetName],
            roa = X.utils.sheet_to_row_object_array(worksheet),
            key;
        switch (chartType) {
            case 'bar':
                var xAxisName,
                    xAxis = [],
                    xKey,
                    series = [];
                for (key in worksheet) {
                    if (worksheet.hasOwnProperty(key)) {
                        var match = /([A-Z]+)(\d+)/.exec(key),
                            col,
                            row,
                            obj = {},
                            objName,
                            objData;
                        if (!match) {
                            continue;
                        }
                        col = match[1]; // ABCD
                        row = match[2]; // 1234
                        if (row === '1') { // 取得x軸key
                            if (col === 'A') {
                                xAxisName = worksheet[key].v;
                            } else {
                                xKey = worksheet[key].v;
                                xAxis.push(xKey);
                            }
                        } else {
                            if (col === 'A') { // 取得各個bar的name並創建單獨的object
                                obj.name = worksheet[key].v;
                                obj.type = 'bar';
                                obj.data = [];
                                series.push(obj);
                            } else { // 取得各個單元格的value並存入對應的object中
                                var index = match[2] - 2;
                                objData = worksheet[key].v;
                                series[index].data.push(objData);
                            }
                        }
                    }
                }
                result.xAxisName = xAxisName;
                result.xAxis = xAxis;
                result.series = series;
                break;
            case 'tree':
                var series = [];
                for (key in worksheet) {
                    if (worksheet.hasOwnProperty(key)) {
                        var match = /([A-Z]+)(\d+)/.exec(key),
                            col,
                            row,
                            obj = {
                                name: '',
                                children: []
                            },
                            childRow,
                            childObjName,
                            nextCol,
                            isPassCurrCol = false,
                            isGetNextCol = false;
                        if (!match) {
                            continue;
                        }
                        matrix = match[0];
                        col = match[1]; // ABCD
                        row = match[2]; // 1234
                        for (childKey in worksheet) { // 取得同col下非空單元格的序號
                            if (worksheet.hasOwnProperty(childKey)) {
                                var childMatch = /([A-Z]+)(\d+)/.exec(childKey);
                                if (!childMatch) {
                                    continue;
                                }
                                if (childMatch[1] === col) { // 同col
                                    if (parseInt(childMatch[2]) <= parseInt(row)) { // 大於序數
                                        continue;
                                    }
                                    childRow = parseInt(childMatch[2]);
                                    break;
                                }
                            }
                        }
                        for (k in worksheet) {
                            if (worksheet.hasOwnProperty(k)) {
                                var kMatch = /([A-Z]+)(\d+)/.exec(k),
                                    kCol,
                                    childObj = {
                                        name: '',
                                        children: []
                                    };
                                if (!kMatch) {
                                    continue;
                                }
                                kCol = kMatch[1];
                                kRow = parseInt(kMatch[2]);
                                if (kCol !== col && isPassCurrCol === false) {
                                    continue;
                                } else if (kCol === col) {
                                    isPassCurrCol = true;
                                    continue;
                                }
                                if (isGetNextCol === false) {
                                    nextCol = kMatch[1];
                                    isGetNextCol = true;
                                }
                                if (kCol === nextCol && kRow > parseInt(row) && kRow < childRow) {
                                    childObj.name = worksheet[k].v;
                                    obj.children.push(childObj);
                                }
                            }
                        }
                        obj.name = worksheet[key].v;
                        series.push(obj);
                        console.log(obj)
                        break;
                    }
                }
                console.log(series)
                break;
            default:
                if(roa.length > 0){
                    result = roa;
                }
        }
    });
    data = result;
}

function handleFile(e) {
    var files = e.target.files,
        f = files[0];
    {
        var reader = new FileReader();
        var name = f.name;
        reader.onload = function(e) {
            var data = e.target.result;
            if(use_worker) {
                xw(data, process_wb);
            } else {
                var wb;
                if(rABS) {
                    wb = X.read(data, {type: 'binary'});
                } else {
                    var arr = fixdata(data);
                    wb = X.read(btoa(arr), {type: 'base64'});
                }
                process_wb(wb);
            }
        };
        if(rABS) {
            reader.readAsBinaryString(f);
        } else {
            reader.readAsArrayBuffer(f);
        }
    }
}

require.config({
        paths: {
            echarts: 'vendor/echarts'
        }
});

$.fn.drawChart = function (option) {
    var ele = $(this);
    charts = new $.charts(ele, option);
    return charts;
}

$.charts = function (ele, option) {
    var styleOption = $.extend({styles: $.charts.defaultStyles}, option),
        style = this.getStyle(styleOption),
        initOption = $.extend({style: style}, option);
    this.selector = ele;
    this.init(ele, initOption);
}

$.extend($.charts, {
    defaults: {
        tree: {
            toolbox: {
                show : true,
                feature : {
                    mark : {show: true},
                    dataView : {show: true, readOnly: false},
                    restore : {show: true},
                    saveAsImage : {show: true}
                }
            },
            series: [
                {
                    name:'树图',
                    type:'tree',
                    orient: 'horizontal',
                    rootLocation: {x: 50, y: '50%'},
                    nodePadding: 25,
                    layerPadding: 100,
                    hoverable: false,
                    roam: true,
                    symbolSize: 6,
                    itemStyle: {
                        normal: {
                            color: '#4883b4',
                            label: {
                                show: true,
                                position: 'right',
                                formatter: "{b}",
                                textStyle: {
                                    color: '#000',
                                    fontSize: 5
                                }
                            },
                            lineStyle: {
                                color: '#ccc',
                                type: 'broken' // 'curve'|'broken'|'solid'|'dotted'|'dashed'

                            }
                        },
                        emphasis: {
                            color: '#4883b4',
                            label: {
                                show: false
                            },
                            borderWidth: 0
                        }
                    },
                    data: []
                }
            ]
        },
        wordCloud: {
            tooltip: {
                show: true,
                feature : {
                    mark : {show: true},
                    dataView : {show: true, readOnly: false},
                    restore : {show: true},
                    saveAsImage : {show: true}
                }
            },
            series: [{
                name: '字符雲',
                type: 'wordCloud',
                size: ['80%', '80%'],
                textRotation : [0, 45, 90, -45],
                textPadding: 0,
                autoSize: {
                    enable: true,
                    minSize: 14
                },
                data: []
            }]
        },
        pie: {
            tooltip : {
                trigger: 'item',
                formatter: "{a} <br/>{b} : {c} ({d}%)"
            },
            legend: {
                orient : 'vertical',
                x : 'left',
                data: []
            },
            toolbox: {
                show : true,
                feature : {
                    dataView : {show: false, readOnly: false},
                    magicType : {
                        show: true,
                        type: ['pie', 'funnel'],
                        option: {
                            funnel: {
                                x: '25%',
                                width: '50%',
                                funnelAlign: 'left',
                                max: 1548
                            }
                        }
                    },
                    restore : {show: true},
                    saveAsImage : {show: true}
                }
            },
            series : [
                {
                    name: '餅圖',
                    type: 'pie',
                    radius : '55%',
                    itemStyle : {
                        normal : {
                            label : {
                                position : 'outer',
                                formatter : function (params){
                                    if(params.percent){
                                        return params.name + params.percent+ '%\n'
                                    }
                                    return params.name + params.value
                                }
                            }
                        }
                    },
                    data: []
                }
            ]
        },
        bar: {
            toolbox: {
                show: true,
                feature: {
                    mark: {show: true},
                    dataView: {show: true, readOnly: false},
                    magicType: {show: true, type: ['line', 'bar']},
                    restore: {show: true},
                    saveAsImage: {show: true}
                }
            },
            calculable: true,
            xAxis: [
                {
                    type: 'category',
                    name: '', // 傳參
                    data: [], // 傳參
                    axisLabel: {
                        show: true,
                        interval: 0,
                        rotate: 45,
                        margin: 8,
                        formatter: '{value}'
                    }
                }
            ],
            yAxis: [
                {
                    type: 'value',
                    axisLabel: {
                        formatter: '{value}'
                    }
                }
            ],
            series: [] // 傳參
        }
    },
    prototype: {
        getStyle: function (option) {
            var styles = option.styles,
                style,
                customStyle = option.customStyle,
                i;
            for (i in styles) {
                if (i === customStyle) {
                    style = styles[i];
                }
            }
            return style;
        },
        init: function (ele, initOption) {
            var $this = $(this),
                id = ele.attr('id'),
                option = initOption,
                type = option.type;
            switch (type) {
                case 'tree':
                    $.charts.prototype.drawTree(id, option);
                    break;
                case 'pie':
                    $.charts.prototype.drawPie(id, option);
                    break;
                case 'wordCloud':
                    $.charts.prototype.drawWordCloud(id, option);
                    break;
                case 'bar':
                    $.charts.prototype.drawBar(id, option);
                    break;
            }
        },
        drawTree: function (id, option) {
            var opt = $.extend($.charts.defaults.tree, option || {});
            require(['echarts', 'echarts/chart/tree'], function (ec) {
                var myChart = ec.init(document.getElementById(id), 'macarons');
                opt.series[0].data = opt.seriesData;
                myChart.setOption(opt);
            });
        },
        drawWordCloud: function (id, option) {
            var opt = $.extend($.charts.defaults.wordCloud, option || {});
            require(['echarts', 'echarts/chart/wordCloud'], function (ec) {
                var myChart = ec.init(document.getElementById(id), 'macarons'),
                    i,
                    g;
                for (i = 0; i < opt.seriesData.length; i++) {
                    g = opt.seriesData[i];
                    if (opt.style) {
                        g.itemStyle = opt.style();
                    }
                }
                opt.series[0].data = opt.seriesData;
                myChart.setOption(opt);
            });
        },
        drawPie: function (id, option) {
            var opt = $.extend($.charts.defaults.pie, option || {});
            require(['echarts', 'echarts/chart/pie', 'echarts/chart/funnel'], function (ec) {
                var myChart = ec.init(document.getElementById(id), 'infographic'),
                    i,
                    g;
                for (i = 0; i < opt.seriesData.length; i++) {
                    g = opt.seriesData[i];
                    if (opt.style) {
                        g.itemStyle = opt.style();
                    }
                }
                opt.series[0].data = opt.seriesData;
                myChart.setOption(opt);
            });
        },
        drawBar: function (id, option) {
            var opt = $.extend($.charts.defaults.bar, option || {});
            require(['echarts', 'echarts/chart/bar', 'echarts/chart/line'], function (ec) {
                var myChart = ec.init(document.getElementById(id), 'macarons'),
                    i,
                    g;
                for (i = 0; i < opt.seriesData.series.length; i++) {
                    g = opt.seriesData.series[i];
                    if (opt.style) {
                        g.itemStyle = opt.style();
                    }
                }
                opt.xAxis[0].data = opt.seriesData.xAxis;
                opt.xAxis[0].name = opt.seriesData.xAxisName;
                opt.series = opt.seriesData.series;
                myChart.setOption(opt);
            });
        }
    },
    defaultStyles: {
        darkStyle: function () {
            return {
                normal: {
                    color: 'rgb(' + [
                        Math.round(Math.random() * 160),
                        Math.round(Math.random() * 160),
                        Math.round(Math.random() * 160)
                    ].join(',') + ')'
                }
            };
        },
        rainbowStyle: function () {
            return {
                normal: {
                    color: function(params) {
                        var colorList = [
                            '#C1232B','#B5C334','#FCCE10','#E87C25','#27727B',
                            '#FE8463','#9BCA63','#FAD860','#F3A43B','#60C0DD',
                            '#D7504B','#C6E579','#F4E001','#F0805A','#26C0C0'
                        ];
                        return colorList[params.dataIndex]
                    },
                    textStyle: {
                        fontFamily: 'Microsoft Yahei, Arial, Verdana, sans-serif'
                    }
                }
            }
        },
        wairoStyle: function () {
            return {
                normal: {
                    color: function(params) {
                        var colorList = [
                            '#89C3EB','#83F6E8','#838BF6','#71C6D4','#7192D4',
                            '#AEDEFF','#9E773D','#EBC389','#4D7D9E','#7AAED1',
                            '#3F596B','#90CEF8'
                        ];
                        return colorList[params.dataIndex]
                    },
                    textStyle: {
                        fontFamily: 'Microsoft Yahei, Arial, Verdana, sans-serif'
                    }
                }
            }
        }
    },
    addStyle: function (style) {
        $.extend($.charts.defaultStyles, style);
    }
});
