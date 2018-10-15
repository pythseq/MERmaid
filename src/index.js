import React from 'react';
import ReactDOM from 'react-dom';
import reactCSS from 'reactcss'
import DeckGL, {ScatterplotLayer, COORDINATE_SYSTEM, OrthographicView} from 'deck.gl';
import { SketchPicker } from 'react-color';
import pako from 'pako';
import * as d3 from 'd3';

const DATA_URL = 'data.csv.gz'

function updateTooltip({x, y, object}) {
    const tooltip = document.getElementById('tooltip');

    if (object) {
	tooltip.style.top = `${y}px`;
	tooltip.style.left = `${x}px`;
	tooltip.innerHTML = `
	    <div><div>${object[2]}</div></div>
	    `;
    } else {
	tooltip.innerHTML = '';
    }
}

export class MERmaid extends React.Component {
    constructor(props) {
	super(props);
	this.state = {
	    data: [],
	    header: ['x','y','test'],
	    options: ['test'],
	    options_selections: {'test':['a','b','c']},
	    origin: [0, 0, 0],
	    num_points: 0,
	    
	    SELECTED: '',
	    SELECTED_COLOR: [0, 128, 255, 255],
	    BG_COLOR: [80, 80, 80, 80],
	    RADIUS: 1
	};

	this.loadData();
	this.updateSelectedColor = this.updateSelectedColor.bind(this);
	this.updateSelection = this.updateSelection.bind(this);
	this.updateRadius = this.updateRadius.bind(this);
    }

    updateRadius(rad) {
	console.log('UPDATING RADIUS')
	console.log(rad.target.value)
	this.setState({ RADIUS: Number(rad.target.value) });
    }
    updateSelectedColor(color) {
	console.log('UPDATING COLOR')
	console.log(color)
	this.setState({ SELECTED_COLOR: color });
    }
    updateSelection(opt) {
	console.log('UPDATING SELECTION')
	console.log(opt.target.value)
	this.setState({ SELECTED: opt.target.value });
    }

    loadData() {
	var logTime = function(text) {
	    console.log('[' + new Date().toUTCString() + '] ' + text);
	}
	var fetch = function(data_url, callback) {
	    logTime('downloading data');
	    var oReq = new XMLHttpRequest();
	    oReq.open("GET", data_url, true);
	    oReq.responseType = "arraybuffer";
	    oReq.onload = function(oEvent) {
		var arrayBuffer = oReq.response;
		if (arrayBuffer) {
		    var byteArray = new Uint8Array(arrayBuffer); // Get the compressed data
		    byteArray = pako.inflate(byteArray) // Decompress the data
		    var s = new TextDecoder("utf-8").decode(byteArray) // Convert to string
		    callback(s)
		}
	    };
	    oReq.send(null);
	}

	var cb = function(data_string, mythis) {
	    logTime('parsing data');
	    
	    var data = d3.csvParseRows(
		data_string,
		(d, i) => {
		    return(d)
		}
	    )

	    logTime('setting data');
	    var header = data.splice(0,1)[0];
	    var options = header.filter(x => ['x', 'y', 'z'].indexOf(x) < 0 );

	    var opts = {};
	    d3.map(options, function(option) {
		var ops = [];
		var j = header.indexOf(option);
		for (var i = 0; i < data.length; i++) {
		    if (data[i][j] in ops) {
			ops[data[i][j]]++;
		    } else {
			ops[data[i][j]] = 1;
		    }
		}
		ops = Object.keys(ops).sort();
		opts[option] = [' '].concat(ops);
	    });
	    logTime('detected options');
	    console.log(opts);
	    console.log(opts[options[0]][0]);
	    
	    var originX = d3.mean(data.map((d) => parseInt(d[header.indexOf('x')])));
	    var originY = d3.mean(data.map((d) => parseInt(d[header.indexOf('y')])));
	    var originZ = d3.mean(data.map((d) => parseInt(d[header.indexOf('z')])));
	    if( originX === undefined) { originX = 0; }
	    if( originY === undefined) { originY = 0; }
	    if( originZ === undefined) { originZ = 0; }
	    var origin = [originX, originY, originZ]
	    logTime('detected origin');
	    console.log(origin)
	    	    
	    mythis.setState({
		data: data,
		header: header,
		options: options,
		options_selections: opts,
		origin: origin,
		num_points: data.length
	    })

	};

	var ccb = (mythis) => ( (data_string) => cb(data_string, mythis) )
	var butt = ccb(this)

	fetch(DATA_URL, butt);
    }

    renderLayers() {
	const {
	    data = this.state.data,
	    header = this.state.header,
	    options = this.state.options,
	    
	    radius = this.state.RADIUS,
	    selectedColor = this.state.SELECTED_COLOR,
	    bgColor = this.state.BG_COLOR,
	    selectedOption = this.state.SELECTED,
	    
	} = this.props;
	
	return [
	    new ScatterplotLayer({
		id: 'scatter-plot',
		data,
		coordinateSystem: COORDINATE_SYSTEM.IDENTITY,
		getPosition: d => [parseFloat(d[header.indexOf('x')]), parseFloat(d[header.indexOf('y')]), parseFloat(d[header.indexOf('z')])],
		getColor: d => (d[header.indexOf(options[0])] === selectedOption ? selectedColor : bgColor),
		getRadius: d => (d[header.indexOf(options[0])] === selectedOption ? 2 : 1),
		radiusScale: radius,
		
		updateTriggers: {
		    getColor: [selectedColor, selectedOption],
		    getRadius: [selectedOption]
		},

		pickable: true,
		onHover: updateTooltip
	    })
	];
    }

    render() {
	const styles = reactCSS({
	    'default': {
		main: {
		    fontFamily: 'Helvetica, Arial, sans-serif',
		    fontSize: '14px',
		    background: `rgba(80,80,80,0.8)`,
		    padding: '10px',
		    width: '200px',
		    position: 'relative',
		    zIndex: '0'
		}
	    }
	})
	
	const {viewState,
	       view = [new OrthographicView({
		   controller: {
		       dragRotate: false,
		       dragPan: true
		   }
	       })]
 	      } = this.props;

	return (
	    <div>
	        <DeckGL
	            views={view}	    
	            viewState={viewState}
	            layers={this.renderLayers()}
	            initialViewState={{
			lookAt: this.state.origin,
			zoom: 0.5
	            }}
	        />
		<div style={ styles.main }>
		<div> points rendered: { this.state.num_points } </div>
		<div> size: <input type="range" min="0.1" max="5" step="0.1" value={this.state.RADIUS} class="slider" onChange={(value) => this.updateRadius(value)}></input></div>
		<Menu
	           id= { this.state.options[0] }
	           options = { this.state.options_selections[this.state.options[0]] }
	           color= { this.state.SELECTED_COLOR }
	           onChangeColor= {(color) => this.updateSelectedColor( [ color.rgb.r, color.rgb.g, color.rgb.b ]) }
	           selected = { this.state.SELECTED }
	           onChangeSelect= {(selected) => this.updateSelection( selected ) }	    
		/>

		<hr></hr>
		
		<a href="data.csv.gz"><button>Download Data</button></a>
		<a href="https://github.com/JEFworks/MERmaid"><button>Source Code</button></a>
		</div>

	    </div>
	);
    }
}


class Menu extends React.Component {    
    constructor(props) {
	super(props);
	this.state = {
	    displayColorPicker: false,
	};
    }

    handleClick = () => {
	this.setState({ displayColorPicker: !this.state.displayColorPicker })
    };

    handleClose = () => {
	this.setState({ displayColorPicker: false })
    };

    render() {
	const styles = reactCSS({
	    'default': {
		label: {
		    height: '18px',
		    padding: '2px',
		    display: 'inline-block',
		    marginRight: '4px'
		},
		color: {
		    position: 'relative',
		    width: '14px',
		    height: '14px',
		    marginTop: '2px',
		    marginBottom: '-2px',
		    borderRadius: '2px',
		    background: `rgb(${ this.props.color[0] }, ${ this.props.color[1] }, ${ this.props.color[2] })`,
		    display: 'inline-block',
		    cursor: 'pointer',
		    zIndex: '1',
		},
		popover: {
		    position: 'absolute',
		    zIndex: '2',
		},
		cover: {
		    position: 'fixed',
		    top: '0px',
		    right: '0px',
		    bottom: '0px',
		    left: '0px',
		},
	    },
	});

	return (
	    <div>
		<span style={ styles.label }> { this.props.id } </span>
	        
		<select style={ styles.label } value={this.props.selected} onChange={ this.props.onChangeSelect }>
		{this.props.options.map((i) => {
		    return (<option value={i}>{i}</option>)
		})}
	        </select>
		
		<div style={ styles.color } onClick={ this.handleClick } />
		{ this.state.displayColorPicker ? <div style={ styles.popover }>
		  <div style={ styles.cover } onClick={ this.handleClose }/>
		  <SketchPicker color={ this.props.color } onChange={ this.props.onChangeColor } />
		  </div> : null }		
	    </div>
	);
    }
}

ReactDOM.render(
    <MERmaid />,
    document.getElementById('root')
);