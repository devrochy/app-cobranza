import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ClientesModule } from "../clientes/clientes.module";
import { GestoresModule } from "../gestores/gestores.module";
import { Cartera } from "../carteras/cartera.entity";
import { CarterasModule } from "../carteras/carteras.module";
import { SecurityModule } from "../security/security.module";
import { PropietariosModule } from "../propietarios/propietarios.module";
import { AplicarEventosOfflineService } from "./aplicar-eventos-offline.service";
import { AplicarOfflineJob } from "./aplicar-offline-job.service";
import { AlertasService } from "./alertas.service";
import { DeviceApiKeyGuard } from "./device-api-key.guard";
import { Device } from "./device.entity";
import { DevicesService } from "./devices.service";
import { EvidenciasOfflineService } from "./evidencias-offline.service";
import { IntentoAcceso } from "./intento-acceso.entity";
import { IntentosAccesoService } from "./intentos-acceso.service";
import { SincronizacionOffline } from "./sincronizacion-offline.entity";
import { SincronizacionOfflineController } from "./sincronizacion-offline.controller";
import { SincronizacionOfflineService } from "./sincronizacion-offline.service";
import { SnapshotCryptoService } from "./snapshot-crypto.service";
import { SnapshotDiaService } from "./snapshot-dia.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Device, SincronizacionOffline, Cartera, IntentoAcceso]),
    SecurityModule,
    JwtModule.register({}),
    CarterasModule,
    PropietariosModule,
    ClientesModule,
    GestoresModule,
  ],
  controllers: [SincronizacionOfflineController],
  providers: [
    DevicesService,
    SincronizacionOfflineService,
    SnapshotDiaService,
    SnapshotCryptoService,
    DeviceApiKeyGuard,
    AplicarEventosOfflineService,
    EvidenciasOfflineService,
    AplicarOfflineJob,
    AlertasService,
    IntentosAccesoService,
  ],
  exports: [AlertasService, IntentosAccesoService],
})
export class SincronizacionOfflineModule {}