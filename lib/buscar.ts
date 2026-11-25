/** ¿Están todas las palabras buscadas en el texto, en cualquier orden? («polo star» encuentra «Roly Star Polo») */
export const todas = (texto: string, buscado: string) => buscado.split(/\s+/).filter(Boolean).every((p) => texto.includes(p));
