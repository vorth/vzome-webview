
var threemaster = threemaster || {};

threemaster.makeCamera = function () {

    var distance = 300;
    var viewRotationMatrix = mat4 .create();
    
    mat4 .identity( viewRotationMatrix );

    return {
    
        reset : function()
        {
            distance = 300;
            viewRotationMatrix = mat4 .create();
            mat4 .identity( viewRotationMatrix );
        },

        zoom : function( delta )
        {
            if ( distance >= delta )
                distance = distance - delta;
        },
        
        setDistance : function( cameraDistance )
        {
            distance = cameraDistance;
        },

        rotate : function( rotation )
        {
            mat4 .multiply( rotation, viewRotationMatrix, viewRotationMatrix );
        },
        
        getPosition : function()
        {
            return [ 0, 0, -distance ];
        },
        
        getRotation : function()
        {
            return viewRotationMatrix;
        }
    
    };
};

threemaster.makeRenderer = function( canvas, scene, camera, stereoView ) {

    var gl;                   // the gl context.
 
    gl = tdl .webgl .setupWebGL( canvas );
    if ( !gl ) {
        return false;
    }

    function setViewport( eye )
    {
        var borderPercent = 0.027;
        var width  = Math.floor( canvas.width  * ( ( 1 - 3 * borderPercent ) / 2 ) );
        var eyeOffset = ( eye + 1 ) / 2;
        var border = canvas.width * borderPercent;
        var left   = Math.floor( border * (eyeOffset + 1 ) + width * eyeOffset );
        var height = Math.floor( canvas.height * 0.9 );
        var bottom = Math.floor( canvas.height * 0.05 );
        var aspectRatio = canvas.clientWidth / canvas.clientHeight;
    
        var my3dLeftLeft = 0,
            my3dRightLeft = 460,
            my3dHeight = 549,
            my3dWidth = 410;

        if ( stereoView )
        {
//             if ( my3d )
//             {
                // switch to goggle-eyed view
                left = ( eye > 0 )? my3dLeftLeft : my3dRightLeft;
                bottom = canvas.height - my3dHeight;
                width = my3dWidth;
                height = my3dHeight;
//                 aspectRatio = width / height;  // may need to leave this as set above
                aspectRatio = 1.10 * aspectRatio;
//             }
//             else {
//                 aspectRatio = 0.52 * aspectRatio;
//             }
            gl.viewport( left, bottom, width, height );
            gl.scissor( left, bottom, width, height );
            gl.enable( gl.SCISSOR_TEST );
        }
        return aspectRatio;
    }
    
    return {
        render : function ()
        {
            var aspectRatio = setViewport( -1 );
            scene .render( gl, aspectRatio, stereoView, -1 );
            if ( stereoView )
            {
                aspectRatio = setViewport( 1 );
                scene .render( gl, aspectRatio, stereoView, 1 );
            }
        }
    };
}

threemaster.makeController = function( canvas, camera ) {

    // document and window are globals accessed here

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
    
    // return value is irrelevant; all the event listener registrations are the side-effect
}
