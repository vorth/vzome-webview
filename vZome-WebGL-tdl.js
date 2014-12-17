
tdl .require( 'tdl.buffers' );
tdl .require( 'tdl.fast' );
tdl .require( 'tdl.fps' );
tdl .require( 'tdl.log' );
tdl .require( 'tdl.math' );
tdl .require( 'tdl.models' );
tdl .require( 'tdl.primitives' );
tdl .require( 'tdl.programs' );
tdl .require( 'tdl.webgl' );

var canvas;   // required as a global by tdl

var makeScene = function( camera )
{
    var meshes = [];
    var program;
    var backgroundColor;

	function load( data )
	{
		var arrayInstances = [];
		var ii, jj, num, mm;
		var newShapes = [];
		var mesh, shape, positions, normals, indices;
		var attribBuffer;
		var expanded;
		var vertexShaderSrc;
		var fragmentShaderSrc;

		backgroundColor = data .background || [ 0.6, 0.6, 0.6 ];

		vertexShaderSrc = [

			"uniform mat4 viewInverse;",
			"uniform vec3 lightWorldPos;",
			"uniform mat4 worldViewProjection;",
			"uniform mat4 worldInverseTranspose;",
			"uniform mat4 orientations[" + data .orientations .length / 16 + "];",

			"attribute vec4 position;",
			"attribute vec3 normal;",
			"attribute vec3 worldPosition;",
			"attribute vec4 color;",
			"attribute vec2 orientation;",

			"varying vec3 v_normal;",
			"varying vec3 v_surfaceToLight;",
			"varying vec3 v_surfaceToView;",
			"varying vec4 v_color;",

			"void main()",
			"{",
			"    vec4 oriented = ( orientations[ int(orientation.x) ] * position );",
			"    vec4 wp = oriented + vec4(worldPosition, 0);",
			"    gl_Position = (worldViewProjection * wp);",
			"    vec4 orientedNormal = ( orientations[ int(orientation.x) ] * vec4(normal, 0) );",
			"    v_normal = (worldInverseTranspose * orientedNormal).xyz;",
			"    v_color = color;",
			"    v_surfaceToLight = lightWorldPos - wp.xyz;",
			"    v_surfaceToView = (viewInverse[3] - wp).xyz;",
			"}"
	
		] .join("\n");
	
		fragmentShaderSrc = [

			"#ifdef GL_ES",
			"precision highp float;",
			"#endif",

			"varying vec3 v_normal;",
			"varying vec3 v_surfaceToLight;",
			"varying vec3 v_surfaceToView;",
			"varying vec4 v_color;",

			"uniform vec4 specular;",
			"uniform float shininess;",
			"uniform float specularFactor;",

			"vec4 lit( float l ,float h, float m )",
			"{",
			"    return vec4( 1.0, max(l, 0.0), (l > 0.0) ? pow(max(0.0, h), m) : 0.0, 1.0 );",
			"}",

			"void main()",
			"{",
			"    vec3 normal = normalize( v_normal );",
			"    vec3 surfaceToLight = normalize( v_surfaceToLight );",
			"    vec3 surfaceToView = normalize( v_surfaceToView );",
			"    vec3 halfVector = normalize( surfaceToLight + surfaceToView );",
			"    vec4 litR = lit( dot( normal, surfaceToLight ), dot( normal, halfVector ), shininess );",
			"    gl_FragColor = vec4( ( vec4(1,1,1,1) * (v_color * litR.y + specular * litR.z * specularFactor) ).rgb, 1.0 );",
			"}"
	
		] .join("\n");

		program = tdl .programs .loadProgram( vertexShaderSrc, fragmentShaderSrc );
		program .use();
		program .setUniform( 'orientations', data .orientations );
		// material
		program .setUniform( 'specular', new Float32Array([1,1,1,1]) );
		program .setUniform( 'shininess', 50 );
		program .setUniform( 'specularFactor', 0.2 );

		for ( jj = 0; jj < data .shapes .length; ++jj ) {
			shape = data .shapes[ jj ];
			positions = new tdl.primitives.AttribBuffer( 3, shape.position.length );
			for ( ii = 0; ii < shape.position.length; ++ii) {
				positions .push( shape.position[ ii ] );
			}
			normals = new tdl.primitives.AttribBuffer( 3, shape.normal.length );
			for ( ii = 0; ii < shape.normal.length; ++ii) {
				normals .push( shape.normal[ ii ] );
			}
			indices = new tdl.primitives.AttribBuffer( 3, shape.indices.length, 'Uint16Array' );
			for ( ii = 0; ii < shape.indices.length; ++ii) {
				indices .push( shape.indices[ ii ] );
			}
			newShapes .push( {
				position :positions,
				normal   :normals,
				indices  :indices,
				// Add extra fields to each geometry
				worldPosition : new tdl.primitives.AttribBuffer( 3, shape.position.length ),
				color         : new tdl.primitives.AttribBuffer( 4, shape.position.length ),
				orientation   : new tdl.primitives.AttribBuffer( 2, shape.position.length )
			});
		}

		// convert data .instances to expanded geometry
		for ( ii = 0; ii < data .instances .length; ++ii )
			arrayInstances .push( newShapes[ data .instances[ ii ] .shape ] );

		expanded = tdl.primitives.concatLarge( arrayInstances );

		// The "expanded .arrays[ mm ] .*" AttribBuffers have now been concatenated, so we can
		//  now fill in the instance data (color, position, and orientation).
		for ( ii = 0; ii < data .instances .length; ++ii ) {
			// copy in colors
			mm = expanded .instances[ii] .arrayIndex; // a mesh index
			jj = expanded .instances[ii] .firstVertex;
			num = expanded .instances[ii] .numVertices;
			attribBuffer = expanded .arrays[ mm ] .color;
			attribBuffer .fillRange( jj, num, data .instances[ii] .color );
			// copy in worldPosition
			attribBuffer = expanded.arrays[ mm ] .worldPosition;
			attribBuffer .fillRange( jj, num, data .instances[ ii ] .location );
			// copy in orientation
			attribBuffer = expanded.arrays[ mm ] .orientation;
			attribBuffer .fillRange( jj, num, [ data .instances[ ii ] .orientation, 0 ]);
		}

		// Step 3: Make meshes from our expanded geometry.
		meshes = [];
		for ( mm = 0; mm < expanded.arrays.length; ++mm )
			meshes .push( new tdl.models.Model( program, expanded .arrays[ mm ], null ) );
	}

	function render( gl, aspectRatio, stereoView, eye )
	{
        var m4 = tdl .fast .matrix4;
        var viewInverse = new Float32Array(16);
        var eyePosition;
        var projection = new Float32Array(16);
        var view = new Float32Array(16);
        var worldRotation = new Float32Array(16);
        var world = new Float32Array(16);
        var worldInverse = new Float32Array(16);
        var worldInverseTranspose = new Float32Array(16);
        var viewProjection = new Float32Array(16);
        var worldViewProjection = new Float32Array(16);
        var target = new Float32Array(3);
        var up = new Float32Array([0,1,0]);
        var lightWorldPos = new Float32Array(3);
		var mm;

        // clear the screen.
        gl.colorMask(true, true, true, true);
        gl.depthMask(true);
        gl.clearColor( backgroundColor[0], backgroundColor[1], backgroundColor[2], 0);
        gl.clearDepth(1);
        gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT );
    
        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);
        
        // some of this should be encapsulated into camera
    
        m4.perspective( projection, tdl .math .degToRad( 20 ), aspectRatio, 1, 5000 );
    
        eyePosition = camera .getPosition();
        if ( stereoView )
        {
            eyePosition[ 0 ] = eyePosition[ 0 ] - eye * eyePosition[ 2 ] * 0.06;
            target = [ 0, 0, eyePosition[ 2 ] * 0.1 ];
        }
    
        m4 .lookAt( view, eyePosition, target, up );
        m4 .mul( viewProjection, view, projection );
        m4 .translation( world, [0, 0, 0] );
        m4 .mul( worldRotation, world, camera .getRotation() );
        m4 .mul( worldViewProjection, worldRotation, viewProjection );
        program .setUniform( 'worldViewProjection', worldViewProjection );
    
        // Put the light near the camera
        tdl .fast .mulScalarVector( lightWorldPos, 10, eyePosition );
        program .setUniform( 'lightWorldPos', lightWorldPos );
    //     tdl .fast .rowMajor .mulMatrix4Vector( lightWorldPos, camera .viewRotationMatrix, lightWorldPos );
		m4 .inverse( worldInverse, worldRotation );
        m4 .inverse( viewInverse, view );
        program .setUniform( 'viewInverse', viewInverse );
        m4 .transpose( worldInverseTranspose, worldInverse );
        program .setUniform( 'worldInverseTranspose', worldInverseTranspose );

        for ( mm = 0; mm < meshes.length; ++mm ) {
            meshes[ mm ] .drawPrep();
            meshes[ mm ] .draw();
        }

        // Set the alpha to 255.
        gl.colorMask( false, false, false, true );
        gl.clearColor( 0, 0, 0, 1 );
        gl.clear( gl.COLOR_BUFFER_BIT );
    }
	
    return {
    	load   : load,
        render : render
    };
}

function initialize()
{
    var currentModel, modelList, nextButton, prevButton, fileChooser;
	var scene, camera, renderer, controller;
    var then = (new Date()).getTime() * 0.001;
    var fpsTimer = new tdl .fps .FPSTimer();
    var fpsElem = document .getElementById( "fps" );
    var rendererActive = false;

    function render()
    {
        tdl .webgl .requestAnimationFrame( render, canvas );
        
        // Compute the elapsed time since the last rendered frame
        // in seconds.
        var now = (new Date()).getTime() * 0.001;
        var elapsedTime = now - then;
        then = now;
        
        // Update the FPS timer.
        fpsTimer.update(elapsedTime);
        fpsElem .innerHTML = fpsTimer.averageFPS;
        
        if ( rendererActive )
	        renderer .render();
    }

    function hasClass(ele,cls) {
        return ele.className.match(new RegExp('(\\s|^)'+cls+'(\\s|$)'));
    }

    function addClass(ele,cls) {
        if (!hasClass(ele,cls)) {
            ele.className += " "+cls;
        }
    }

    function removeClass(ele,cls) {
        if (hasClass(ele,cls)) {
            var reg = new RegExp('(\\s|^)'+cls+'(\\s|$)');
            ele.className=ele.className.replace(reg,' ');
        }
    }

    var downloadCurrentModel = function()
    {
        var dist;
		var modelUrl = modelList[ currentModel ] .firstChild .nodeValue;
		dist = modelList[ currentModel ] .getAttribute( "cameraDistance" );
		if ( dist ) {
			dist = parseInt( dist );
		}
		downloadModel( modelUrl, dist );
	}

    var downloadModel = function( modelUrl, dist )
    {
		if ( modelUrl .indexOf( "http" ) === 0 )
		{
			modelUrl = "http://vzome.com/proxy/forward.py?tail=" + modelUrl;
		}
		var request = new XMLHttpRequest();
		request .open( "GET", modelUrl );
		request .onreadystatechange = function () {
			var parsed;
			if ( request .readyState === 4 ) {
				parsed = JSON.parse( request .responseText );

				rendererActive = false;

				scene .load( parsed );
				
				if ( dist )
					camera .setDistance( dist );
				else
					camera .reset();

				rendererActive = true;
			}
		}
		request .send();
	}

    var nextModel = function() {
        if ( currentModel < modelList .length - 1 ) {
            currentModel = currentModel + 1;
            downloadCurrentModel();
            removeClass( prevButton, "inactive" );
            if ( currentModel === modelList .length - 1 ) {
                addClass( nextButton, "inactive" );
            }
        }
    }

    var prevModel = function() {
        if ( currentModel > 0 ) {
            currentModel = currentModel - 1;
            downloadCurrentModel();
            removeClass( nextButton, "inactive" );
            if ( currentModel === 0 ) {
                addClass( prevButton, "inactive" );
            }
        }
    }

    var openFile = function() {
        filepicker.pick( { extension: '.vZome' },
          function( FPFile ){
            console .log( JSON.stringify( FPFile ) );
            camera .reset();
            downloadModel( FPFile.url );
          }
        );
    }
 
    canvas = document .getElementById( "modelView" );
    
    var my3d = document .getElementById( "my3d" );
    
	camera = threemaster .makeCamera();
	scene = makeScene( camera );
    renderer = threemaster .makeRenderer( canvas, scene, camera, my3d );
    controller = threemaster .makeController( canvas, camera );
    
    var modelPath = document .location .hash .substring(1);

    var args = document.location.search.substring(1).split('&');
    var argsParsed = {};
	var i;
    for (i=0; i < args.length; i++)
    {
        arg = unescape(args[i]);

        if (arg.indexOf('=') == -1)
        {
            argsParsed[arg.trim()] = true;
        }
        else
        {
            kvp = arg.split('=');
            argsParsed[kvp[0].trim()] = kvp[1].trim();
        }
    }

    nextButton = document .getElementById( 'next' );
    prevButton = document .getElementById( 'prev' );
    openButton = document .getElementById( 'open' );
    if ( modelPath )
    {
        if ( nextButton ) addClass( nextButton, "inactive" );
        if ( prevButton ) addClass( prevButton, "inactive" );

        if ( modelPath .indexOf( '.json', modelPath.length - 5 ) == -1 )
            modelPath = modelPath + '.json';
		downloadModel( modelPath );
    }
    else
    {
        modelList = document .getElementById( "models" ) .getElementsByTagName( 'li' );
        currentModel = 0;
        downloadCurrentModel();

        filepicker.setKey( 'ACWyTwSaKo1IMsum2ajglz' );
        nextButton .addEventListener( 'click', nextModel, false );
        prevButton .addEventListener( 'click', prevModel, false );
        openButton .addEventListener( 'click', openFile, false );
    }

    render();
    return true;
}

window .onload = initialize;
