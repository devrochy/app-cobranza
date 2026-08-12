import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  RelationId,
  ValueTransformer,
} from "typeorm";
import { Ruta } from "./ruta.entity";

const numericTransformer: ValueTransformer = {
  to: (value: number): number => value,
  from: (value: string): number => Number.parseFloat(value),
};

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
}
