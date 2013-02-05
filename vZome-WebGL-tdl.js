tdl .require( 'tdl.buffers' );
tdl .require( 'tdl.fast' );
tdl .require( 'tdl.fps' );
tdl .require( 'tdl.log' );
tdl .require( 'tdl.math' );
tdl .require( 'tdl.models' );
tdl .require( 'tdl.primitives' );
tdl .require( 'tdl.programs' );
tdl .require( 'tdl.webgl' );

var canvas;   // the canvas, required as a global by tdl

function CreateApp( canvas, gl, my3d )
{
    var g_eyeRadius         = 300;
    
    var stereoView = true;
    
    // pre-allocate a bunch of arrays
    var projection = new Float32Array(16);
    var view = new Float32Array(16);
    var worldRotation = new Float32Array(16);
    var world = new Float32Array(16);
    var worldInverse = new Float32Array(16);
    var worldInverseTranspose = new Float32Array(16);
    var viewProjection = new Float32Array(16);
    var worldViewProjection = new Float32Array(16);
    var viewInverse = new Float32Array(16);
    var viewProjectionInverse = new Float32Array(16);
    var target = new Float32Array(3);
    var up = new Float32Array([0,1,0]);
    var lightWorldPos = new Float32Array(3);
    var one4 = new Float32Array([1,1,1,1]);

    var mouseDown = false;
    var lastMouseX = null;
    var lastMouseY = null;
	var lastRoll = 0;
	var lastPitch = 0;
	var lastYaw = 0;

    var program;
    var scene;

    var mouseRotationMatrix = mat4 .create();

//     function handleKeyPress( event )
//     {}
//     window.addEventListener('keypress', handleKeyPress, false);

    function zoom( delta )
    {
        if ( g_eyeRadius >= delta ) {
            g_eyeRadius = g_eyeRadius - delta;
        }
    }
    
    function wheel( event )
    {
        var delta = 0;
        if ( !event ) {
            event = window.event;
        }
        if (event.wheelDelta) {
            delta = event.wheelDelta/120; 
        } else if (event.detail) {
            delta = -event.detail/3;
        }
        if (delta) {
            zoom( delta * 3 );
        }
        if (event.preventDefault) {
            event.preventDefault();
        }
        event.returnValue = false;
    }
    
    function handleMouseDown( event )
    {
        mouseDown = true;
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
    }

    function handleMouseUp( event )
    {
        mouseDown = false;
    }

    function handleMouseMove( event )
    {
        if (!mouseDown) {
          return;
        }
        var newX = event.clientX;
        var newY = event.clientY;
        
        var deltaX = newX - lastMouseX;
        var newRotationMatrix = mat4.create();
        mat4.identity(newRotationMatrix);
        mat4.rotate(newRotationMatrix, tdl .math .degToRad(deltaX / 3), [0, 1, 0]);
        
        var deltaY = newY - lastMouseY;
        mat4.rotate(newRotationMatrix, tdl .math .degToRad(deltaY / 3), [-1, 0, 0]);
        
        mat4.multiply( newRotationMatrix, mouseRotationMatrix, mouseRotationMatrix );
        
        lastMouseX = newX;
        lastMouseY = newY;
    }

    function handleTouchStart( event )
    {
		if ( event && event .preventDefault )
			event .preventDefault();
		var touch = event .touches[0];
        lastMouseX = touch.clientX;
        lastMouseY = touch.clientY;
    }

    function handleTouchMove( event )
    {
		if ( event && event .preventDefault )
			event .preventDefault();
		var touch = event .touches[0];
        var newX = touch.clientX;
        var newY = touch.clientY;
        
        var deltaX = newX - lastMouseX;
        var newRotationMatrix = mat4.create();
        mat4.identity(newRotationMatrix);
        mat4.rotate(newRotationMatrix, tdl .math .degToRad(deltaX / 3), [0, 1, 0]);
        
        var deltaY = newY - lastMouseY;
        mat4.rotate(newRotationMatrix, tdl .math .degToRad(deltaY / 3), [-1, 0, 0]);
        
        mat4.multiply( newRotationMatrix, mouseRotationMatrix, mouseRotationMatrix );
        
        lastMouseX = newX;
        lastMouseY = newY;
    }

    function animate()
    {
        var deltaX = 2;
        var newRotationMatrix = mat4.create();
        mat4.identity( newRotationMatrix );
        mat4.rotate( newRotationMatrix, tdl .math .degToRad(deltaX / 3), [0, 1, 0] );
        
        var deltaY = 2;
        mat4.rotate( newRotationMatrix, tdl .math .degToRad(deltaY / 3), [-1, 0, 0] );
        
        mat4.multiply( newRotationMatrix, mouseRotationMatrix, mouseRotationMatrix );
    }

    function handleOrientationChange( event )
    {
		if ( event && event .preventDefault )
			event .preventDefault();
    }

    function handleOrientationEvent( e )
    {

        // Get the orientation of the device in 3 axes, known as alpha, beta, and gamma, 
        // represented in degrees from the initial orientation of the device on load
 
        var yaw = e.alpha,
            pitch = e.beta,
            roll = e.gamma;
 
        var newRotationMatrix = mat4.create();
        mat4.identity( newRotationMatrix );
        mat4.rotate( newRotationMatrix, tdl .math .degToRad( pitch - lastPitch ), [-1, 0, 0] );
        mat4.rotate( newRotationMatrix, tdl .math .degToRad( yaw - lastYaw ), [ 0, 0, -1] );
        mat4.rotate( newRotationMatrix, tdl .math .degToRad( roll - lastRoll ), [ 0, 1, 0 ] );
		lastYaw = yaw;
        lastPitch = pitch;
        lastRoll = roll;
        
        // mat4.multiply( newRotationMatrix, mouseRotationMatrix, mouseRotationMatrix );
    }

    function finishLoading()
    {
        var newInstances = [],
            models = [],
            arrayInstances = [];
        var ii, jj;
        var newShapes = [];
        var model;
        var uniform;
        var index;
        var attribBuffer;
        var expanded;

        if ( scene === null ) {
            return;
        }
	
		if ( ! scene .background )
		{
            scene .background = [ 0.6, 0.6, 0.6 ];
		}
		
        scene .uniforms = {
            viewInverse: viewInverse,
            lightWorldPos: lightWorldPos,
            specular: one4,
            shininess: 50,
            specularFactor: 0.2,
            world: world,
            worldViewProjection: worldViewProjection,
            worldInverse: worldInverse,
            worldInverseTranspose: worldInverseTranspose,
            orientations : scene .orientations
        };

        for ( ii = 0; ii < scene .instances .length; ++ii )
        {
            newInstances .push({
              x: scene .instances[ ii ] .location[ 0 ],
              y: scene .instances[ ii ] .location[ 1 ],
              z: scene .instances[ ii ] .location[ 2 ],
              colorMult: new Float32Array( scene .instances[ ii ] .color ),
              arrayIndex: scene .instances[ ii ] .shape,
              orientation: scene .instances[ ii ] .orientation
            });
        }

        for ( jj = 0; jj < scene.shapes.length; ++jj ) {
            var shape = scene.shapes[ jj ];
            var positions = new tdl.primitives.AttribBuffer(3, shape.position.length);
            for ( ii = 0; ii < shape.position.length; ++ii) {
                positions.push(shape.position[ ii ]);
            }
            var normals = new tdl.primitives.AttribBuffer(3, shape.normal.length);
            for ( ii = 0; ii < shape.normal.length; ++ii) {
                normals.push(shape.normal[ ii ]);
            }
            var indices = new tdl.primitives.AttribBuffer(3, shape.indices.length, 'Uint16Array');
            for ( ii = 0; ii < shape.indices.length; ++ii) {
                indices.push(shape.indices[ ii ]);
            }
            newShapes.push({
                position:positions,
                normal:normals,
                indices:indices,
                // Add extra fields to each geometry
                worldPosition:new tdl.primitives.AttribBuffer(3, shape.position.length),
                colorMult:new tdl.primitives.AttribBuffer(4, shape.position.length),
                orientation:new tdl.primitives.AttribBuffer(2, shape.position.length)
            });
        }

        // Expand scene.shapes from newInstances to geometry.

        // Step 2: convert newInstances to expanded geometry
        for ( ii = 0; ii < newInstances.length; ++ii) {
            arrayInstances.push(newShapes[ newInstances[ii].arrayIndex ]);
        }
        expanded = tdl.primitives.concatLarge(arrayInstances);

        // Step 3: Make models from our expanded geometry.
        for ( ii = 0; ii < expanded.arrays.length; ++ii) {
            model = new tdl.models.Model( program, expanded.arrays[ii], null );
            models.push(model);
        }

        // Step 4: Copy in Colors
        for ( ii = 0; ii < newInstances.length; ++ii) {
            index = expanded .instances[ii] .arrayIndex;
            newInstances[ii] .firstVertex = expanded .instances[ii] .firstVertex;
            newInstances[ii] .numVertices = expanded .instances[ii] .numVertices;
            newInstances[ii] .expandedArrayIndex = index;
            attribBuffer = expanded .arrays[index] .colorMult;
            attribBuffer.fillRange( newInstances[ii] .firstVertex, newInstances[ii] .numVertices, newInstances[ii] .colorMult );
        }
        for ( ii = 0; ii < models.length; ++ii) {
            attribBuffer = expanded.arrays[ii].colorMult;
            models[ii].setBuffer('colorMult', attribBuffer);
        }

        // copy in worldPosition
        for ( ii = 0; ii < newInstances.length; ++ii) {
            index = newInstances[ii] .expandedArrayIndex;
            attribBuffer = expanded.arrays[index].worldPosition;
            attribBuffer.fillRange( newInstances[ii] .firstVertex, newInstances[ii] .numVertices,
                                    [ newInstances[ii].x, newInstances[ii].y, newInstances[ii].z ] );
        }
        for ( ii = 0; ii < models.length; ++ii) {
            attribBuffer = expanded.arrays[ii].worldPosition;
            models[ii].setBuffer('worldPosition', attribBuffer);
        }

        // copy in orientation
        for ( ii = 0; ii < newInstances.length; ++ii) {
            var instance = newInstances[ii];
            var index = instance.expandedArrayIndex;
            attribBuffer = expanded.arrays[index].orientation;
            attribBuffer.fillRange(instance.firstVertex, instance.numVertices, [instance.orientation, 0]);
        }
        for ( ii = 0; ii < models.length; ++ii) {
            attribBuffer = expanded.arrays[ii].orientation;
            models[ii].setBuffer('orientation', attribBuffer);
        }

        scene.render = function () {
            for ( uniform in scene .uniforms ) {
                program .setUniform( uniform, scene .uniforms[ uniform ] );
            }
            for ( ii = 0; ii < models.length; ++ii) {
                model = models[ii];
                model .drawPrep();
                model .draw();
            }
            // Set the alpha to 255.
            gl.colorMask(false, false, false, true);
            gl.clearColor(0, 0, 0, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
        }
    }

    function parseAndLoadScene( json )
    {
	   scene = JSON.parse( json );

       finishLoading();
    }

    function startLoading( modelUrl, cameraDistance )
    {
		g_eyeRadius = cameraDistance;
        scene = null; // this disables rendering while loading a different model
        var request = new XMLHttpRequest();
        request.open( "GET", modelUrl );
        request.onreadystatechange = function () {
            if ( request.readyState === 4 ) {
               parseAndLoadScene( request.responseText );
            }
        }
        request.send();
    }

    function modelIsReady()
    {
        return scene && scene .render;
    }

    function render()
    {
        renderBegin( -1 );
        scene .render();
        if ( stereoView )
        {
            renderBegin( 1 );
            scene .render();
        }
    }

    function renderBegin( eye )
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
        var eyePosition = new Float32Array(3);

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
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    
        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);
    
        // Compute a projection and view matrices.
        m4.perspective( projection, tdl .math .degToRad( 20 ), aspectRatio, 1, 5000 );
    
        eyePosition = [ 0, 0, -g_eyeRadius];
        if ( stereoView )
        {
            eyePosition = [ eye * g_eyeRadius * 0.06, 0, -g_eyeRadius];
            target = [ 0, 0, -g_eyeRadius * 0.1 ];
        }
    
        m4 .lookAt( view, eyePosition, target, up );
        m4 .mul( viewProjection, view, projection );
        m4 .inverse( viewInverse, view );
        m4 .inverse( viewProjectionInverse, viewProjection );
    
        // Put the light near the camera
        tdl .fast .mulScalarVector(lightWorldPos, 10, [0,0,-g_eyeRadius]);
    
    //     tdl .fast .rowMajor .mulMatrix4Vector( lightWorldPos, mouseRotationMatrix, lightWorldPos );
    
        // compute shared matrices
        m4.translation(world, [0, 0, 0]);
        m4.mul( worldRotation, world, mouseRotationMatrix );
        m4.mul( worldViewProjection, worldRotation, viewProjection );
        m4.inverse(worldInverse, worldRotation);
        m4.transpose(worldInverseTranspose, worldInverse);
    }
    

    /* Initialization code. */

	var fragmentShaderSrc = [

		"#ifdef GL_ES",
		"precision highp float;",
		"#endif",

		"varying vec3 v_normal;",
		"varying vec3 v_surfaceToLight;",
		"varying vec3 v_surfaceToView;",
		"varying vec4 v_colorMult;",

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
		"    gl_FragColor = vec4( ( vec4(1,1,1,1) * (v_colorMult * litR.y + specular * litR.z * specularFactor) ).rgb, 1.0 );",
		"}"
		
	] .join("\n");
	
	var vertexShaderSrc = [

		"uniform mat4 viewInverse;",
		"uniform vec3 lightWorldPos;",
		"uniform mat4 worldViewProjection;",
		"uniform mat4 worldInverseTranspose;",
		"uniform mat4 orientations[120];",

		"attribute vec4 position;",
		"attribute vec3 normal;",
		"attribute vec3 worldPosition;",
		"attribute vec4 colorMult;",
		"attribute vec2 orientation;",

		"varying vec4 v_position;",
		"varying vec3 v_normal;",
		"varying vec3 v_surfaceToLight;",
		"varying vec3 v_surfaceToView;",
		"varying vec4 v_colorMult;",

		"void main()",
		"{",
		"    vec4 oriented = ( orientations[ int(orientation.x) ] * position );",
		"    vec4 wp = oriented + vec4(worldPosition, 0);",
		"    v_position = (worldViewProjection * wp);",
		"    vec4 orientedNormal = ( orientations[ int(orientation.x) ] * vec4(normal, 0) );",
		"    v_normal = (worldInverseTranspose * orientedNormal).xyz;",
		"    v_colorMult = colorMult;",
		"    v_surfaceToLight = lightWorldPos - wp.xyz;",
		"    v_surfaceToView = (viewInverse[3] - wp).xyz;",
		"    gl_Position = v_position;",
		"}"
		
	] .join("\n");
	program = tdl .programs .loadProgram( vertexShaderSrc, fragmentShaderSrc );

    mat4 .identity( mouseRotationMatrix );
    canvas .onmousedown = handleMouseDown;
	canvas .addEventListener( 'touchstart', handleTouchStart );
	canvas .addEventListener( 'touchmove', handleTouchMove );
    document .onmouseup = handleMouseUp;
    document .onmousemove = handleMouseMove;
    if ( window .addEventListener ) {
        window .addEventListener( 'DOMMouseScroll', wheel, false );
		window .addEventListener( 'deviceorientation', handleOrientationEvent, false );
    }
    window .onmousewheel = document .onmousewheel = wheel;

    return {
        modelReady   : modelIsReady,
        startLoading : startLoading,
        parseAndLoadScene : parseAndLoadScene,
        render       : render
    };
}

function hasClass(ele,cls) {
    return ele.className.match(new RegExp('(\\s|^)'+cls+'(\\s|$)'));
}

function addClass(ele,cls) {
    if (!this.hasClass(ele,cls)) {
        ele.className += " "+cls;
    }
}

function removeClass(ele,cls) {
    if (hasClass(ele,cls)) {
        var reg = new RegExp('(\\s|^)'+cls+'(\\s|$)');
        ele.className=ele.className.replace(reg,' ');
    }
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

    function render()
    {
        tdl .webgl .requestAnimationFrame( render, canvas );
                
        if ( ! app .modelReady() )
        {
            fpsElem.innerHTML = 'loading...';
            return;
        }

        // Compute the elapsed time since the last rendered frame
        // in seconds.
        var now = (new Date()).getTime() * 0.001;
        var elapsedTime = now - then;
        then = now;
        
        // Update the FPS timer.
        fpsTimer.update(elapsedTime);
        fpsElem .innerHTML = fpsTimer.averageFPS;
        
        app .render();
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
 
    var handleDropBox = function( e ) {
		var start = "https://dl.dropbox.com/" .length;
		var url = "http://vzome.com/dropbox/forward.py?tail=" + e.files[0].link .substring( start );
		app .startLoading( url, 300 );
    }
 
    var handleFiles = function() {
    	var file = this .files[ 0 ];
    	var reader = new FileReader();
    	reader .onload = function ( e ) {
    		app .parseAndLoadScene( e .target .result );
    	}
		reader .readAsText( file );
	}

    canvas = document .getElementById( "modelView" );
    
    var my3d = document .getElementById( "my3d" );
    
    gl = tdl .webgl .setupWebGL( canvas );
    if ( !gl ) {
        return false;
    }
    
    if ( my3d ) {
//        document .getElementById( "fps" ) .addClass( nextButton, "inactive" );
    }
    
    app = CreateApp( canvas, gl, my3d );
    
    var modelPath = document .location .hash .substring(1);
	var dist, distStr;
    if ( !modelPath )
    {
        modelList = document .getElementById( "models" ) .getElementsByTagName( 'li' );
        modelPath = modelList[ 0 ] .firstChild .nodeValue;
		distStr = modelList[ 0 ] .getAttribute( "cameraDistance" );
		if ( distStr ) {
			dist = parseInt( distStr );
		}

        nextButton = document .getElementById( 'next' );
        nextButton .addEventListener( 'click', nextModel, false );
        prevButton = document .getElementById( 'prev' );
        prevButton .addEventListener( 'click', prevModel, false );
        fileChooser = document .getElementById( 'file-chooser' );
        fileChooser .addEventListener( 'DbxChooserSuccess', handleDropBox, false );
    }

    app .startLoading( modelPath, dist );
    render();
    return true;
}

window .onload = initialize;
