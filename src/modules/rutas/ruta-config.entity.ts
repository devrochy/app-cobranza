import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from "typeorm";
import { numericTransformer } from "../../common/numeric-transformer";
import { Ruta } from "./ruta.entity";

export const DIAS_NO_LABORABLES = ["solo_domingos", "domingos_y_feriados"] as const;
export type DiasNoLaborables = (typeof DIAS_NO_LABORABLES)[number];

@Entity("ruta_config")
export class RutaConfig {
  @PrimaryGeneratedColumn()
  id!: number;

  @OneToOne(() => Ruta, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "ruta_id" })
  ruta!: Ruta;

  @RelationId((config: RutaConfig) => config.ruta)
  rutaId!: number;

  @Column({ type: "int" })
  cuotasMinimasPrestamo!: number;

  @Column({ type: "int" })
  cuotasAtrasoUmbral!: number;

  @Column()
  manejoCupoActivo!: boolean;

  @Column({ type: "numeric", precision: 10, scale: 2, transformer: numericTransformer })
  cupoDefault!: number;

  @Column()
  recargoActivo!: boolean;

  @Column()
  bloquearCambioInteres!: boolean;

  @Column()
  comisionActiva!: boolean;

  @Column({ type: "numeric", precision: 5, scale: 2, transformer: numericTransformer })
  comisionPorcentaje!: number;

  @Column()
  mostrarFechaUltimaLiquidada!: boolean;

  @Column()
  mostrarCaja!: boolean;

  @Column()
  mostrarCobradoLiquidada!: boolean;

  @Column()
  mostrarPrestamos!: boolean;

  @Column()
  eliminarPrestamosApk!: boolean;

  @Column()
  reconocimientoFacialActivo!: boolean;

  @Column()
  eliminarPagosApk!: boolean;

  @Column()
  eliminarGastosApk!: boolean;

  @Column()
  eliminarInyeccionApk!: boolean;

  @Column()
  eliminarAbonosApk!: boolean;

  @Column()
  registrarInyeccionApk!: boolean;

  @Column()
  generarReportesApk!: boolean;

  @Column()
  ocultarCartera!: boolean;

  @Column()
  mostrarCobroEstimado!: boolean;

  @Column()
  bloqueoAutomaticoClientes!: boolean;

  @Column()
  permitirCambioFechaPrestamo!: boolean;

  @Column()
  borrarClientesSinDeuda!: boolean;

  @Column({ name: "dias_no_laborables", type: "varchar", default: "solo_domingos" })
  diasNoLaborables!: DiasNoLaborables;
}
