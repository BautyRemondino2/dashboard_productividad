import Card from "@/components/Card";
import Tiles from "./Tiles";
import { getActividadUsa, getCondicionesFinancieras } from "@/lib/eeuu";

/**
 * El otro lado del mandato dual: si la actividad se enfría, la Fed recorta
 * aunque la inflación no haya llegado al 2%. Las nóminas y los pedidos de
 * seguro de desempleo son los dos que mueven el precio de los bonos el mismo
 * día que salen.
 */
export async function PanelActividad() {
  const ind = await getActividadUsa().catch(() => []);
  if (ind.length === 0) return null;
  return (
    <Card
      titulo="Actividad y empleo"
      nota="El otro lado del mandato dual de la Fed"
      acento="#34d399"
      cuerpo={false}
    >
      <Tiles indicadores={ind} />
    </Card>
  );
}

/**
 * El canal por el que la tasa de la Fed llega efectivamente a un bono argentino.
 *
 * La Fed fija una tasa overnight, no el costo de fondeo de un emergente. Lo que
 * transmite una cosa a la otra es el apetito por riesgo: cuando el spread high
 * yield se abre y el VIX salta, los Globales caen aunque la tasa de política no
 * se haya movido un punto básico. Por eso este panel y no sólo el de tasas.
 */
export async function PanelCondiciones() {
  const ind = await getCondicionesFinancieras().catch(() => []);
  if (ind.length === 0) return null;
  return (
    <Card
      titulo="Condiciones financieras"
      nota="Cuánto apetito por riesgo hay · el canal que llega a los emergentes"
      acento="#f87171"
      cuerpo={false}
    >
      <Tiles indicadores={ind} />
    </Card>
  );
}
