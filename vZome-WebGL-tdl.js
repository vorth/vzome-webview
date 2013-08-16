
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
var scene;
var camera = threemaster .makeCamera();

function decodeScene( data )
{
    var meshes = [],
        arrayInstances = [];
    var ii, jj, num, mm;
    var newShapes = [];
    var mesh, shape, positions, normals, indices;
    var attribBuffer;
    var expanded;
    var vertexShaderSrc;
    var fragmentShaderSrc;
    var newScene = {};

    newScene .background = data .background || [ 0.6, 0.6, 0.6 ];

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

    newScene .program = tdl .programs .loadProgram( vertexShaderSrc, fragmentShaderSrc );
    newScene .program .use();
    newScene .program .setUniform( 'orientations', data .orientations );
	// material
	newScene .program .setUniform( 'specular', new Float32Array([1,1,1,1]) );
	newScene .program .setUniform( 'shininess', 50 );
	newScene .program .setUniform( 'specularFactor', 0.2 );

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
    for ( mm = 0; mm < expanded.arrays.length; ++mm )
        meshes .push( new tdl.models.Model( newScene .program, expanded .arrays[ mm ], null ) );

    newScene .render = function () {
    	var oneMesh;
        for ( mm = 0; mm < meshes.length; ++mm ) {
            oneMesh = meshes[ mm ];
            oneMesh .drawPrep();
            oneMesh .draw();
        }
    }
    return newScene;
}

function startLoading( modelUrl, cameraDistance )
{
    camera .setDistance( cameraDistance );
    scene = null; // this disables rendering while loading a different model

    if ( modelUrl .indexOf( "http" ) === 0 )
    {
        modelUrl = "http://vzome.com/proxy/forward.py?tail=" + modelUrl;
    }
    var request = new XMLHttpRequest();
    request.open( "GET", modelUrl );
    request.onreadystatechange = function () {
        if ( request .readyState === 4 ) {
            parsed = JSON.parse( request .responseText );

			scene = decodeScene( parsed );
        }
    }
    request.send();
}

function CreateApp( canvas, gl, my3d )
{    
    var stereoView = my3d;
    
    function render( scene, camera )
    {
        if ( !( scene && scene .render ) )
        {
            return;
        }

        renderView( scene, camera, -1 );
        if ( stereoView )
        {
            renderView( scene, camera, 1 );
        }
    }

    function renderView( scene, camera, eye )
    {
        var m4 = tdl .fast .matrix4;
    
        var borderPercent = 0.027;
        var width  = Math.floor( canvas.width  * ( ( 1 - 3 * borderPercent ) / 2 ) );
        var eyeOffset = ( eye + 1 ) / 2;
        var border = canvas.width * borderPercent;
        var left   = Math.floor( border * (eyeOffset + 1 ) + width * eyeOffset );
        var height = Math.floor( canvas.height * 0.9 );
        var bottom = Math.floor( canvas.height * 0.05 );
        var aspectRatio = canvas.clientWidth / canvas.clientHeight;
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

        var my3dTop = 40,
            my3dLeftLeft = 0,
            my3dRightLeft = 460,
            my3dHeight = 549,
            my3dWidth = 410;

        if ( stereoView )
        {
            if ( my3d )
            {
                // switch to goggle-eyed view
                left = ( eye > 0 )? my3dLeftLeft : my3dRightLeft;
                bottom = canvas.height - my3dHeight;
                width = my3dWidth;
                height = my3dHeight;
//                 aspectRatio = width / height;  // may need to leave this as set above
                aspectRatio = 1.10 * aspectRatio;
            }
            else {
                aspectRatio = 0.52 * aspectRatio;
            }
            gl.viewport( left, bottom, width, height );
            gl.scissor( left, bottom, width, height );
            gl.enable( gl.SCISSOR_TEST );
        }
    
        // clear the screen.
        gl.colorMask(true, true, true, true);
        gl.depthMask(true);
        gl.clearColor( scene .background[0], scene .background[1], scene .background[2], 0);
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
        scene .program .setUniform( 'worldViewProjection', worldViewProjection );
    
        // Put the light near the camera
        tdl .fast .mulScalarVector( lightWorldPos, 10, eyePosition );
        scene .program .setUniform( 'lightWorldPos', lightWorldPos );
    //     tdl .fast .rowMajor .mulMatrix4Vector( lightWorldPos, camera .viewRotationMatrix, lightWorldPos );
		m4 .inverse( worldInverse, worldRotation );
        m4 .inverse( viewInverse, view );
        scene .program .setUniform( 'viewInverse', viewInverse );
        m4 .transpose( worldInverseTranspose, worldInverse );
        scene .program .setUniform( 'worldInverseTranspose', worldInverseTranspose );

        scene .render();

        // Set the alpha to 255.
        gl.colorMask( false, false, false, true );
        gl.clearColor( 0, 0, 0, 1 );
        gl.clear( gl.COLOR_BUFFER_BIT );
    }

    return {
        startLoading      : startLoading,
        render            : render,
    };
}

function initialize()
{
    var app;
    var gl;                   // the gl context.
    var then = (new Date()).getTime() * 0.001;
    var fpsTimer = new tdl .fps .FPSTimer();
    var fpsElem = document .getElementById( "fps" );
    var currentModel = 0;
    var modelList;
    var nextButton;
    var prevButton;
    var fileChooser;
    var mouseDown = false;
    // TODO encapsulate these
    var lastRoll = 0;
    var lastPitch = 0;
    var lastYaw = 0;
        
    var trackball = ( function( rotatable ) {
    
        var lastMouseX = null;
        var lastMouseY = null;

        return {

            reset : function( event )
            {
                lastMouseX = event .clientX;
                lastMouseY = event .clientY;
            },

            roll : function( event )
            {
                var newX = event.clientX;
                var newY = event.clientY;
        
                var deltaX = newX - lastMouseX;
                var newRotationMatrix = mat4.create();
                mat4.identity( newRotationMatrix );
                mat4.rotate( newRotationMatrix, tdl .math .degToRad( deltaX / 3 ), [0, 1, 0] );
        
                var deltaY = newY - lastMouseY;
                mat4.rotate( newRotationMatrix, tdl .math .degToRad( deltaY / 3 ), [-1, 0, 0] );
        
                rotatable .rotate( newRotationMatrix );
        
                lastMouseX = newX;
                lastMouseY = newY;
            }
        };
    }( camera ));

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

    var nextModel = function() {
        var dist, distStr;
        if ( currentModel < modelList .length - 1 ) {
            currentModel = currentModel + 1;
            modelPath = modelList[ currentModel ] .firstChild .nodeValue;
            distStr = modelList[ currentModel ] .getAttribute( "cameraDistance" );
            if ( distStr ) {
                dist = parseInt( distStr );
            }
            app .startLoading( modelPath, dist );
            removeClass( prevButton, "inactive" );
            if ( currentModel === modelList .length - 1 ) {
                addClass( nextButton, "inactive" );
            }
        }
    }

    var prevModel = function() {
        if ( currentModel > 0 ) {
            currentModel = currentModel - 1;
            modelPath = modelList[ currentModel ] .firstChild .nodeValue;
            distStr = modelList[ currentModel ] .getAttribute( "cameraDistance" );
            if ( distStr ) {
                dist = parseInt( distStr );
            }
            app .startLoading( modelPath, dist );
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
            app .startLoading( FPFile.url, 300 );
          }
        );
    }
 
    var handleDropBox = function( e ) {
        app .startLoading( e.files[0].link, 300 );
    }
 
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
        
        app .render( scene, camera );
    }

    canvas = document .getElementById( "modelView" );
    
    var my3d = document .getElementById( "my3d" );
    
    gl = tdl .webgl .setupWebGL( canvas );
    if ( !gl ) {
        return false;
    }
    
    app = CreateApp( canvas, gl, my3d );
    
    canvas .onmousedown = function( event )
    {
        mouseDown = true;
        trackball .reset( event );
    }
    document .onmouseup = function( event )
    {
        mouseDown = false;
    }
    document .onmousemove = function( event )
    {
        if ( !mouseDown ) return;
        trackball .roll( event );
    }

    canvas .addEventListener( 'touchstart', function( event )
    {
        if ( event && event .preventDefault )
            event .preventDefault();
        trackball .reset( event .touches[0] );
    } );
    canvas .addEventListener( 'touchmove', function( event )
    {
        if ( event && event .preventDefault )
            event .preventDefault();
        trackball .roll( event .touches[0] );
    } );

    var zoomWheel = function( event )
    {
        var delta = 0;
        if ( !event )
            event = window.event;
        if ( event.wheelDelta )
            delta = event .wheelDelta / 120; 
        else if ( event.detail )
            delta = - event .detail /3;
        if ( delta )
            camera .zoom( delta * 3 );
        if ( event .preventDefault )
            event .preventDefault();
        event .returnValue = false;
    }

    var orientCamera = function( e )
    {
        // Get the orientation of the device in 3 axes, known as alpha, beta, and gamma, 
        // represented in degrees from the initial orientation of the device on load
 
        var yaw = e.alpha,
            pitch = e.beta,
            roll = e.gamma;
 
        var newRotationMatrix = mat4.create();
        mat4.identity( newRotationMatrix );
        mat4.rotate( newRotationMatrix, tdl .math .degToRad( pitch - lastPitch ), [ -1, 0, 0 ] );
        mat4.rotate( newRotationMatrix, tdl .math .degToRad( yaw - lastYaw ), [ 0, 0, -1 ] );
        mat4.rotate( newRotationMatrix, tdl .math .degToRad( roll - lastRoll ), [ 0, 1, 0 ] );
        lastYaw = yaw;
        lastPitch = pitch;
        lastRoll = roll;
        
        camera .rotate( newRotationMatrix );
    }

//     function handleKeyPress( event )
//     {}
//     window.addEventListener('keypress', handleKeyPress, false);

    var animate = function()
    {
        var deltaX = 2;
        var newRotationMatrix = mat4.create();
        mat4.identity( newRotationMatrix );
        mat4.rotate( newRotationMatrix, tdl .math .degToRad(deltaX / 3), [0, 1, 0] );
        
        var deltaY = 2;
        mat4.rotate( newRotationMatrix, tdl .math .degToRad(deltaY / 3), [-1, 0, 0] );
        
        camera .rotate( newRotationMatrix );
    }

    if ( window .addEventListener ) {
        window .addEventListener( 'DOMMouseScroll', zoomWheel, false );
//      window .addEventListener( 'deviceorientation', orientCamera, false );
    }
    window .onmousewheel = document .onmousewheel = zoomWheel;

    var modelPath = document .location .hash .substring(1);

    var args = document.location.search.substring(1).split('&');
    var argsParsed = {};
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

    var dist, distStr;
    dist = 240;
    nextButton = document .getElementById( 'next' );
    prevButton = document .getElementById( 'prev' );
    openButton = document .getElementById( 'open' );
    if ( modelPath )
    {
        if ( nextButton ) addClass( nextButton, "inactive" );
        if ( prevButton ) addClass( prevButton, "inactive" );

        if ( modelPath .indexOf( '.json', modelPath.length - 5 ) == -1 )
            modelPath = modelPath + '.json';
    }
    else
    {
        modelList = document .getElementById( "models" ) .getElementsByTagName( 'li' );
        modelPath = modelList[ 0 ] .firstChild .nodeValue;
        distStr = modelList[ 0 ] .getAttribute( "cameraDistance" );
        if ( distStr ) {
            dist = parseInt( distStr );
        }

        filepicker.setKey( 'ACWyTwSaKo1IMsum2ajglz' );
        nextButton .addEventListener( 'click', nextModel, false );
        prevButton .addEventListener( 'click', prevModel, false );
        openButton .addEventListener( 'click', openFile, false );

        fileChooser = document .getElementById( 'file-chooser' );
        if ( fileChooser )
        {
            fileChooser .addEventListener( 'DbxChooserSuccess', handleDropBox, false );
        }
    }

    app .startLoading( modelPath, dist );
    render();
    return true;
}

window .onload = initialize;
