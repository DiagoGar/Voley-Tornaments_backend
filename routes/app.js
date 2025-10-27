const texto1 = document.getElementById('texto1');
const texto2 = document.getElementById('texto2');
const texto3 = document.getElementById('texto3');
const texto4 = document.getElementById('texto4');
const boton1 = document.getElementById('boton1')
const boton2 = document.getElementById('boton2')
const boton3 = document.getElementById('boton3')
const boton4 = document.getElementById('boton4')
const saludo = document.getElementById('saludo')
const nombre = document.getElementById('nombre-input')

boton1.addEventListener('click', function(){
    texto1.style.fontSize = "40px"
    texto1.style.fontFamily = "yellow"
})

boton2.addEventListener('click', function(){
    if(texto2.style.display === "none"){
        texto2.style.display = 'block'
    }else{
        texto2.style.display = 'none'
    }
})

boton3.addEventListener('click', function(){
    const mensaje = nombre.value
    saludo.innerHTML = "Hola, " + mensaje
})

boton4.addEventListener('click', function(){
    texto4.style.border = "5px solid black"
    texto4.style.borderRadius = "30px"
})