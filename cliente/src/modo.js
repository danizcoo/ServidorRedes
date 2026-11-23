import { createContext, useContext } from 'react';

// Modo técnico: mostra detalhes do protocolo (requisições HTTP, códigos de
// status, caminhos e o JSON FHIR). Desligado, a interface fica voltada ao
// usuário final (recepção/secretaria).
export const ModoTecnico = createContext(false);
export const useModoTecnico = () => useContext(ModoTecnico);
